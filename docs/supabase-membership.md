# Supabase 会员后端说明

这个项目保持“本地优先”：收藏句、词库、练习记录暂时仍在浏览器本地。Supabase 负责账号登录、会员状态、服务端权限快照、Stripe 订阅同步，以及后续云同步的基础设施。

## 远端项目

- 项目 ref：`ehmgfpksqyvtqqopuaii`
- 项目 URL：`https://ehmgfpksqyvtqqopuaii.supabase.co`
- 当前状态：`ACTIVE_HEALTHY`
- 已应用迁移：`membership_v1`、`membership_security_fixes`、`entitlement_overrides`、`entitlement_override_read_policy`、`admin_console`、`admin_console_indexes`
- 已部署函数：`me`、`billing-checkout`、`stripe-webhook`、`auth-callback`、`admin`
- 邮箱验证落地页：`https://ehmgfpksqyvtqqopuaii.supabase.co/functions/v1/auth-callback`

## 架构

- Supabase Auth 负责邮箱登录。Google OAuth 目前还没有启用。
- Postgres 保存用户资料、Stripe customer ID、订阅状态、用量记录和管理员权限覆盖。
- RLS 限制普通登录用户只能读取自己的资料、订阅状态、用量和覆盖记录。
- Stripe Checkout 用于创建订阅。
- Stripe webhook 用于把订阅状态同步回 Supabase。
- 扩展启动或刷新时调用 `me`，用远端权限快照替换本地 Free 默认权限。

## 数据表

- `profiles`：用户公开资料，主键对应 `auth.users.id`。
- `billing_customers`：Supabase 用户和 Stripe customer 的绑定关系。
- `subscriptions`：Stripe 订阅状态，映射到扩展的 `free | pro` 套餐模型。
- `usage_events`：服务端用量记录，用于后续做不可绕过的额度校验。
- `entitlement_overrides`：管理员手动设置的套餐、额度和功能覆盖。
- `admin_users`：允许访问管理员后台的账号和角色。
- `admin_audit_logs`：管理员权限操作审计记录。

相关迁移文件：

- `supabase/migrations/20260601000000_membership.sql`
- `supabase/migrations/20260601002000_membership_security_fixes.sql`
- `supabase/migrations/20260601003000_entitlement_overrides.sql`
- `supabase/migrations/20260601004000_entitlement_override_read_policy.sql`
- `supabase/migrations/20260601005000_admin_console.sql`
- `supabase/migrations/20260601006000_admin_console_indexes.sql`

## Edge Functions

- `me`：校验 Supabase access token，返回 `{ user, entitlement }`。
- `billing-checkout`：校验用户身份，返回 Stripe Checkout URL。
- `stripe-webhook`：校验 Stripe webhook signature，并同步订阅状态。
- `auth-callback`：邮箱验证后的稳定落地页。
- `admin`：校验登录用户是否在 `admin_users` 中，并提供用户搜索、权限读取、权限保存和审计写入。

## 密钥配置

示例文件在：

```text
supabase/functions/.env.example
```

需要把真实值设置到 Supabase 项目 secrets 中：

```bash
supabase secrets set --env-file supabase/functions/.env.example
```

不要把 `SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY` 或 Stripe webhook secret 放进 Chrome 扩展。扩展里只能放 Supabase publishable key。

当前 Supabase 插件可以部署 schema 和 Edge Functions，但没有开放写入 secrets 的工具，所以 Stripe 相关 secrets 仍需要在 Supabase Dashboard 或 Supabase CLI 里手动设置。

## 邮箱验证跳转配置

如果验证邮件打开后跳到 `localhost:3000/#access_token=...`，说明 Supabase Auth 还在使用默认 Site URL。

需要在 Supabase Dashboard 配置：

1. 打开 `Authentication > URL Configuration`。
2. 将 `Site URL` 设置为：

```text
https://ehmgfpksqyvtqqopuaii.supabase.co/functions/v1/auth-callback
```

3. 在 `Redirect URLs` 中加入同一个 URL。
4. 如果使用自定义邮件模板，确认链接使用 `{{ .RedirectTo }}`。

## Stripe webhook

Stripe webhook endpoint：

```text
https://ehmgfpksqyvtqqopuaii.supabase.co/functions/v1/stripe-webhook
```

需要订阅这些 Stripe 事件：

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 扩展端接入

扩展已经有第一版 Supabase 邮箱/密码登录：

1. 公开项目配置在 `src/shared/supabaseConfig.ts`。
2. Supabase REST Auth/session 逻辑在 `src/background/supabaseAuth.ts`。
3. runtime message 支持注册、登录、退出和打开 Checkout。
4. `GET_BOOTSTRAP` 会在有有效 token 时调用 `me`，否则回退到本地匿名模式。
5. 本地学习记录仍然使用原本的匿名本地用户 ID 保存。

## 管理员后台

没有默认管理员账号，也没有默认管理员密码。

管理员使用普通 Supabase 邮箱账号登录，但必须先加入 `public.admin_users`。扩展设置页会在管理员登录后显示“管理员后台”按钮；也可以直接打开构建产物里的 `admin.html`。

首次授权 owner：

```sql
insert into public.admin_users (user_id, role, created_by)
select id, 'owner', id
from auth.users
where email = 'YOUR_ADMIN_EMAIL'
on conflict (user_id) do update set
  role = excluded.role,
  is_enabled = true,
  updated_at = now();
```

详细说明见 `docs/admin-management.md`。

## 正式上线前待办

1. 设置 Stripe function secrets。
2. 配置 Supabase Auth 的 Site URL、Redirect URLs、邮件模板和 Google OAuth provider。
3. 打开 Supabase Auth 的 leaked password protection。
4. 把付费 AI 调用迁移到 Edge Function，避免扩展端绕过 Pro 权限和额度。
5. 增加本地学习数据到云端账号的合并/同步。
6. 后续增加管理员之间的邀请、禁用和更细粒度审计筛选。

## AI API Key 安全说明

管理员后台可以管理模型名、供应商、base URL 和功能开关，但不应在前端保存或回显真实 API Key。真实 Key 应放在 Supabase Edge Function secrets、Supabase Vault 或服务端密钥管理器里，并由 Edge Function 代理 AI 请求。
