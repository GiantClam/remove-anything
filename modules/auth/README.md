# Auth 模块接入说明

- 通用接口
```ts
export interface AuthSession { userId?: string; email?: string; name?: string }
export interface AuthProvider { getCurrentUser(req?: any): Promise<AuthSession | null> }
```

- 项目适配器（示例）
```ts
import { createProjectAuthProvider } from "@/modules/auth/adapter";
const auth = createProjectAuthProvider();
const user = await auth.getCurrentUser();
```

- 在 API 路由中使用
```ts
const auth = createProjectAuthProvider();
const user = await auth.getCurrentUser();
if (!user) return new Response('Not authenticated', { status: 401 });
```

