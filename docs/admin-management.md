# 管理员后台与权限管理

## 是否有默认管理员账号

没有默认管理员账号，也没有默认管理员密码。

管理员使用 Supabase Auth 的邮箱账号登录，但必须同时存在于 `public.admin_users` 表中，才可以进入后台。这样可以避免在 Chrome 扩展里内置管理员密码、service role key 或任何可直接修改权限的密钥。

## 管理员后台入口

构建后会生成：

```text
admin.html
```

访问方式：

- 已是管理员的账号登录扩展设置页后，会看到“管理员后台”按钮。
- 也可以直接打开扩展页面 `admin.html`。

后台支持：

- 搜索用户邮箱或昵称。
- 查看用户当前套餐、订阅状态、管理员覆盖和今日用量。
- 设置 `free | pro` 套餐。
- 设置权限覆盖是否启用。
- 设置过期时间。
- 设置功能开关。
- 设置每日额度。
- 撤销手动覆盖。
- 查看最近审计记录。

真正的读写操作都通过 `admin` Edge Function 完成。前端只持有普通 Supabase access token，不持有 service role key。

## 首个管理员设置

首个管理员需要在 Supabase Dashboard 的 SQL Editor 里手动授予。先确保目标邮箱已经注册并验证，然后执行：

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

角色说明：

- `owner`：可管理用户权限，后续可扩展为管理其他管理员。
- `admin`：可管理用户权限。
- `viewer`：只读查看用户和权限。

禁用管理员：

```sql
update public.admin_users
set is_enabled = false,
    updated_at = now()
where user_id = 'ADMIN_USER_UUID';
```

## 邮箱验证跳到 localhost 的原因

注册后点击验证邮件，浏览器跳到 `localhost:3000/#access_token=...`，是因为 Supabase Auth 还在使用默认 `Site URL`。邮箱验证本身可以成功，所以你仍然能正常登录；只是验证完成后的落地页面不存在。

已经新增并部署了一个稳定的验证落地页：

```text
https://ehmgfpksqyvtqqopuaii.supabase.co/functions/v1/auth-callback
```

还需要在 Supabase Dashboard 手动配置一次：

1. 打开 `Authentication > URL Configuration`。
2. 把 `Site URL` 设置为：

```text
https://ehmgfpksqyvtqqopuaii.supabase.co/functions/v1/auth-callback
```

3. 在 `Redirect URLs` 里也加入同一个 URL。
4. 如果自定义过邮件模板，确认链接使用 `{{ .RedirectTo }}`，不要只写 `{{ .SiteURL }}`。

扩展注册请求现在已经会显式带这个 `redirect_to`。另外，正式上线前建议打开 `Authentication > Security > Leaked password protection`。

## 用户账号管理

账号本身仍在 Supabase Dashboard 管理：

- 路径：`Authentication > Users`
- 可以查看注册用户。
- 可以确认邮箱是否已验证。
- 可以邀请或创建用户。
- 可以触发密码重置。
- 可以按需删除用户。

Chrome 扩展里的管理员后台管理的是权限和额度，不负责创建 Auth 用户。

## 权限计算顺序

`me` Edge Function 会按下面顺序计算用户权限：

1. `public.entitlement_overrides` 中启用且未过期的管理员覆盖记录。
2. `public.subscriptions` 中 `active` 或 `trialing` 的 Stripe 订阅。
3. 默认 Free 权限。

所以后台保存的手动覆盖优先级最高。

## 可管理功能键

- `basicSubtitles`
- `localLibrary`
- `aiTranslation`
- `aiExplanation`
- `speechScoring`
- `cloudSync`
- `advancedExport`
- `batchTranslation`
- `longTermBackup`

## 可管理额度键

- `translate`
- `explain`
- `speechScore`
- `practiceGenerate`

## 审计记录

管理员每次保存或撤销用户权限，都会写入：

```text
public.admin_audit_logs
```

记录内容包括操作人、目标用户、动作、修改前后快照和时间。

## AI 模型和 API Key 安全边界

管理员后台可以安全管理这些非敏感配置：

- AI 功能是否启用。
- 默认供应商。
- 默认模型名。
- 默认 base URL。
- 温度、最大 token、超时等参数。

真实 API Key 不应该保存在 Chrome 扩展、`chrome.storage.local`、公开前端代码、普通 Supabase 表或任何会返回给浏览器的接口里。

推荐做法：

1. API Key 放在 Supabase Edge Function secrets、Supabase Vault 或其他服务端密钥管理器里。
2. 管理员后台只保存非敏感配置，例如 `model`、`base_url`、`provider`。
3. 扩展端调用自己的 Edge Function，由服务端读取密钥并请求 AI 供应商。
4. Edge Function 返回最终结果，不返回 API Key。
5. 日志和审计记录只记录密钥是否已配置，不记录明文。

也就是说，管理员“改模型”安全；管理员“在浏览器页面里输入并可回显 API Key”不安全。后续如果要做全局 AI 配置，应该先把 AI 请求迁移到 Edge Function，再让后台管理模型和非敏感参数。
