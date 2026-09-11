# dsh-user-plugins

一个 DSH 插件（host + 浏览器双面），在 Web GUI 的 **设置 → 插件** 里增加一个
**「我安装的插件」** 标签页，列出你通过 `dsh plugin --profile <name> add` 装进各
profile 的插件：安装源（spec）、磁盘版本、贡献类型（插件包 / 前端 / 库）、以及该插件
在当前加载器里的实时状态。

中文 | [English](README.en.md)

安装：

```sh
dsh plugin --profile web add github:inxups/dsh-user-plugins
```

装完**重启 dsh** 让插件进入组合。若从源码运行，把 `dsh` 换成 `pnpm dsh`。

## 它和自带的「Plugin list」有什么区别

DSH 自带 `ui-settings-plugin-inventory`（设置 → 插件 → Plugin list）展示的是**加载器
里所有条目**：官方包和第三方包混在一起，且没有安装源、没有版本、不区分是哪个 profile。
两者互补：

| | Plugin list（自带） | 我安装的插件（本插件） |
|---|---|---|
| 数据源 | 加载器条目（运行时） | profile 的 `package.json` 依赖 + bundle 列表（磁盘） |
| 范围 | 全部组成的插件，含官方包 | **只列你装进 profile 的包**，`@deepseek-ai/*` 一律不显示 |
| 安装源 spec | 无 | 有（`github:` / `link:` / 版本范围） |
| 版本 | 无 | 有（读包的 manifest） |
| 归属 profile | 无 | 有，并标出当前运行中的那个 |

自带包在界面上不做开关、不折叠，直接过滤掉 —— 想看它们用隔壁的 Plugin list。

## 结构

```
dsh-user-plugins/
├── package.json          # 声明 dsh.bundle（host 行）与 dsh.client（浏览器半边）
├── cordis.patch.yml      # bundle 层：把 host 行插入 profile 的插件名单
├── lib/index.js          # host 半边：扫描 profile 目录 + /dsh-user-plugins/api/list
├── lib/client.js         # 浏览器半边（构建产物，随包分发）
├── src/client/           # 浏览器半边源码（React + TSX）
│   ├── index.ts          # Cordis 注册：locale 命名空间 + 标签页
│   ├── UserPluginsTab.tsx # 面板本体 + selectUserPlugins 纯函数
│   └── locales.ts        # zh / en 字典
├── scripts/build.mjs     # 用 esbuild 产出 lib/client.js
└── tests/                # host、client、集成三层 node:test 用例
```

host 半边零运行时依赖（只用 `node:fs` / `node:path`）。浏览器半边只用平台模块
（`react` + `@deepseek-ai/dsh-client-ui-primitives`），不引入任何第三方 UI 库。

## 多语言

文案全部走本插件自己的 locale 命名空间 **`settings.userPlugins`**，提供中文与英文两套
字典，没有硬编码prose。切换 GUI 语言时标签标题和面板内容都会实时跟随：

```ts
ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-user-plugins: dictionaries')
const t = ctx.locale.bind(NS)

ctx.slots.register({
  name: 'settings.plugins.tab',
  id: 'user-installed',
  label: () => t('tab'),   // thunk：每次读取都重新求值 → 跟随当前语言
  locale: NS,              // 把框架合成的 t 座位放到组件 props 上
}, UserPluginsTab)
```

两个机制各自负责一半：

- **标签标题**：`label` 传 thunk 而非字符串 —— slot 层记录的是 `SlotLabel = string | (() => string)`，
  每次读取都重新调用，所以**不需要重注册**就能跟随语言切换。
- **面板内容**：注册时声明 `locale: NS`，框架把 `t` 注入组件 props；渲染器已把每个
  outlet 订阅到 locale revision，因此切换语言会整片重渲染。

字典维护约定（`locales.ts`）：

- `zh` 是**键的唯一来源**，写成 `satisfies Record<string, string>`。
- `en` 写成 `satisfies Record<UserPluginsLocaleKey, string>` —— 在带类型检查的消费方那里，
  漏译会编译失败。
- 本包的发布产物由 esbuild 直出、**不经过类型检查**，所以 `tests/client.test.mjs` 在运行时
  再兜一层：断言 en 的键集与 zh 完全一致、无空翻译、且每个 `{placeholder}` 与中文源一致
  （占位符漏写会渲染出原始 `{count}`）。
- 英文缺失时的兜底链由 locale 服务提供（en 是链尾）。

## 界面

标签页的控件全部来自平台自带的 UI 原子，因此和 GUI 其余部分共用同一套设计 token，
换主题、切深浅色都会自动跟随：

| 元素 | 来自 |
|---|---|
| 刷新按钮 | `Button`（`variant="outline"`、`size="sm"`）+ `IconRefreshOutline16` |
| 搜索框 | `Input` + `IconSearchOutline16` |
| 版本 / 类型标签 | `Tag`（`neutral` / `info` / `outline` / `quiet` 调色板） |
| 实时状态圆点 | `StateDot`（`done` / `ongoing` / `error` / `idle`，`ongoing` 自带跑马灯动画） |

刷新时按钮图标旋转并禁用按钮，标签文字保持不变（避免宽度跳动）；失败时保留上次结果并在
上方提示，不会把面板清空。

## 安装

```sh
dsh plugin --profile web add /绝对路径/dsh-user-plugins
```

`dsh plugin` 会在 profile 目录里转发给 pnpm，并把本包追加进 `dsh.profile.bundles`
（因为它声明了 `dsh.bundle`）。之后**重启 dsh** 让新插件进入组合。

若从源码运行，把上面的 `dsh` 换成 `pnpm dsh`。

## 为什么提交构建产物

`lib/client.js` 是构建产物，**且刻意入库**。

`dsh plugin add <git-url>` 时 pnpm 是**克隆仓库**，本包没有 `prepare` 脚本，消费者机器上不会
构建任何东西；而 `package.json` 的 `main` / `exports` 指向 `lib/`。不提交产物，装下来的就是个
用不了的包。

「改为安装时构建」可行但有实打实的代价，以下是针对 pnpm 11 的实测结论：

- pnpm 默认阻止 git 依赖执行构建脚本（`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`）。
- `allowBuilds` 白名单要求 **`包名@git URL#commit SHA`** 的完整形式，只写包名会被拒绝。于是
  每个消费者都得手改自己 profile 的 `pnpm-workspace.yaml`，而且**每推一个新 commit 就失效一次**。

提交产物绕开了这一切。它唯一的风险是「产物与源码脱节」，由 CI 兜住：CI 重新构建，若 `lib/`
有差异就失败。本地跑同一条检查：

```sh
npm run verify:build
```

## 开发

```sh
npm install                 # 只装 esbuild（精确锁版本）

# 改完浏览器半边后重新构建
npm run build

# 三层测试（27 个用例：host 13 / client 12 / 端到端 2）
npm test

# 重建并检查产物是否与源码脱节（CI 跑的就是这条）
npm run verify:build
```

没有本地安装时，构建也会从 DSH 检出里找 esbuild —— 设 `DSH_SOURCE` 指向检出根目录，或
`DSH_ESBUILD` 指向具体的 esbuild 路径。

`lib/client.js` 必须按包名注册（`window.__ModuleLoader__.load({ id: '<包名>' })`），
否则客户端会报 `loaded without registering`。`scripts/build.mjs` 从 `package.json`
读取 `name` 作为 id，所以改包名不需要改构建脚本。

## 数据与接口

`GET /dsh-user-plugins/api/list` 返回只读快照：

```jsonc
{
  "home": "/Users/you/.dsh",
  "profiles": [{
    "name": "web",
    "dir": "/Users/you/.dsh/profiles/web",
    "bundles": ["@deepseek-ai/dsh-base", "dsh-memory-evolve", "..."],
    "active": true,               // 与加载器条目匹配最多的 profile
    "plugins": [{
      "name": "dsh-memory-evolve",
      "spec": "github:csyangwen/dsh-memory-evolve",
      "shipped": false,           // 是否官方 @deepseek-ai/* 包
      "source": "profile",        // profile 依赖 | installation（由 dsh 安装提供）
      "version": "0.1.0",
      "kind": "bundle",           // bundle | client | plain
      "client": true,             // 是否带浏览器半边
      "bundleEnabled": true,      // 是否在 profile 的 bundle 列表里
      "entryId": "dsh-memory-evolve",
      "phase": "active",          // pending|loading|active|failed|unloading|null
      "enabled": true
    }]
  }]
}
```

只读：不提供任何启用/禁用/安装/卸载能力，与自带清单一致。接口仍然返回完整快照
（含自带包与 `shipped` 标志），**过滤只发生在前端** —— 这样数据层保持诚实，界面规则
由 `selectUserPlugins()` 一处决定，并有单测覆盖。

## 已知限制

- `version` / `description` 只对 profile 自己 `node_modules` 里的包可读；由 dsh 安装
  提供的 `@deepseek-ai/*` 包不落 profile，因此这些字段为 `null`（`source` 标为
  `installation`）。这是刻意的：官方包不是「你安装的」。
- 当前运行中的 profile 靠「与加载器条目匹配数最多」推断，不是从启动参数读取。
- 数据按请求实时读取，没有变更订阅；面板上的「刷新」按钮重新拉取。
- 插件自身的 `description`（`package.json` 里那句）不在字典内 —— 它是包元数据，
  由各插件作者自己决定语言，所以英文界面下也可能显示中文描述。
- 目前只有 zh / en 两套字典；跟随 GUI 已注册的语言，新增语言需要再加一份字典。

## 许可

MIT
