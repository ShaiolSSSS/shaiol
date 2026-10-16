# Shaiol
个人网站、作品档案与每日开发学习日志，统一部署在 GitHub Pages。

网站：https://shaiolssss.github.io/shaiol/
工作日志：https://shaiolssss.github.io/shaiol/logs/
源码：https://github.com/ShaiolSSSS/shaiol

## 每日日志

在 `logs/YYYY/MM/YYYY-MM-DD.md` 写当天的 Markdown 日志，例如 `logs/2026/10/2026-10-10.md`。
参考 `templates/daily.md`；同一天补充原文件，不重复创建。
提交到 `main` 后，GitHub Actions 会自动生成日志列表和阅读页，无需手工编辑列表或复制到另一份日记。
阅读页为 `/shaiol/logs/YYYY-MM-DD/`，有全部日志、前后日期和原始记录链接。

仓库和日志均公开，不保存密码、口令原文、令牌、私钥、私人联系方式、无关个人信息或完整聊天记录。
旧 `Work-Journal` 私有仓库保留为迁移前的备份；2026-10-10 起，新日志只写入本仓库。

## 项目工作台

独立入口：<https://shaiolssss.github.io/shaiol/workspace/>。不加入博客的首页／作品／关于主导航，使用单独的页面布局和交互。

支持任务表、甘特图、流程看板、负责人、阶段、排期、前置关系、里程碑和按工作量加权的执行进度。任务可归档、恢复、导出。甘特图通过点击任务编辑排期，不会自动移动其他任务的日期。

真实项目需要 Supabase Auth 和数据库；只有加入项目的账号可以读取、更新该项目。设置项目阶段和加入成员仅限项目负责人。所有写操作经过数据库权限及版本校验，同一任务被同时修改时，后保存的一方会得到冲突提示。

**当前仓库只提供页面、虚构演示和待接入的配置；未连接数据库时，不能保存真实团队项目。** 演示在内存中运行，刷新会重置，不会变成真实任务。真实项目记录不放入仓库，也不缓存为浏览器本地任务文件。

接入方法见 [工作台配置说明](docs/workspace-setup.md)。公开配置在 `public/assets/planner-config.json`，只填项目 URL 和 publishable／anon key，禁止填入 secret／service_role key。数据库结构与权限在 `supabase/schema.sql`。

本地检查：`node scripts/test-planner.mjs`、`node scripts/build.mjs`、`node scripts/check.mjs`。工作台脚本和样式分别为 `public/assets/planner.js`、`planner-model.js`、`planner.css`，入口为 `src/pages/planner.html`。

### 自动记录

本对话的 Codex 自动任务每天北京时间 22:00 汇总本机可访问的《千禧频道》开发与学习相关对话。
区分用户完成、助手完成、讨论决定、待办阻碍和记录依据；计划、建议与未观察到的线下活动不算已完成。
本机需要开机、Codex 可运行，并能连接 GitHub。GitHub Pages 负责发布日志页面，不自行读取对话。

## 内容修改
- 首页：src/pages/home.html
- 作品：src/pages/works.html
- 关于：src/pages/about.html
- 项目详情：src/pages/channel2000.html
- 文章：src/pages/about-this-space.html
- 共用导航和页脚：scripts/build.mjs
- 日志阅读页与 Markdown 格式：scripts/journal.mjs
- 样式：public/assets/site.css
- 菜单、入场动画与星门：public/assets/site.js
- 反色鼠标圆点与惯性滚动：public/assets/effects.js

提交到 main 后，GitHub Actions 自动构建并发布。无需安装依赖。
日志支持标题、段落、列表、引用、代码块、行内代码、粗体和链接。原始 HTML 会显示为文字。
本地运行 node scripts/build.mjs、node scripts/check.mjs，然后 node scripts/preview.mjs。

直接在 GitHub 打开上面的内容文件，点编辑，完成后把修改提交到 `main`，网站就会自动更新。
每日日志的标题和正文都在对应日期的 `.md` 文件里。文章页面可以修改 HTML 标签中的文字和链接；保留标签结构。
首页的文章列表标题在 `src/pages/home.html`，文章标题改变后需同步修改该列表文字。
`README.md` 只更新仓库说明，`templates/daily.md` 只更新写作模板，不会改动已有文章。
`dist/` 是自动生成的发布文件，不要在这里改文章。新增日常日志会自动加入日志列表；新建其他文章还需要配置文章路由和链接。

## 交互效果
桌面鼠标为随背景反色的小圆点，链接悬停时放大，移动时轻微跟随。
桌面滚轮有渐缓惯性；手机触摸、弹窗、可独立滚动区域、键盘和滚动条保留浏览器原有操作。
滚动使用 [Lenis](https://github.com/darkroomengineering/lenis) 1.3.26，随站点托管在 `public/assets/vendor/`，不依赖外部 CDN；许可证见同目录的 `lenis-LICENSE.txt`。
入场画面先留白，逐字显示 WELCOME，再从字底中心展开横线，随后向上淡出；同一浏览会话只播放一次。
系统开启“减少动态效果”后，停用滚动惯性和鼠标跟随延迟。

## 星门
连续点击页脚星星三次，星星旋转变白，口令框在左侧展开；输入当前口令，按回车或箭头进入公开日志列表。
按 Esc、再次点击星星或点击外侧可收起输入框；手机上展开区域另起一行，保留页脚导航。
口令框为白底，日文提示为灰色，输入内容以密码形式遮挡；使用 `current-password` 标记，供浏览器密码管理器自动填充。
日志不需要登录；首页不列出日志，知道链接的人可以直接阅读。
星门只是趣味入口，不提供隐私保护。
口令原文不会进入公开仓库。public/assets/gate.json 仅包含盐值、加密参数和密文。

