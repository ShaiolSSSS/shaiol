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

### 自动记录

本对话的 Codex 自动任务每天北京时间 23:00 汇总本机可访问的《千禧频道》开发与学习相关对话。
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

提交到 main 后，GitHub Actions 自动构建并发布。无需安装依赖。
日志支持标题、段落、列表、引用、代码块、行内代码、粗体和链接。原始 HTML 会显示为文字。
本地运行 node scripts/build.mjs、node scripts/check.mjs，然后 node scripts/preview.mjs。

## 星门
连续点击页脚星星三次打开口令框，原口令进入公开日志列表。
日志不需要登录；首页不列出日志，知道链接的人可以直接阅读。
星门只是趣味入口，不提供隐私保护。
口令原文不会进入公开仓库。public/assets/gate.json 仅包含盐值、加密参数和密文。

