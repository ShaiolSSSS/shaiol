# Shaiol
个人网站与作品档案，部署在 GitHub Pages。

网站：https://shaiolssss.github.io/shaiol/
源码：https://github.com/ShaiolSSSS/shaiol

## 内容修改
- 首页：src/pages/home.html
- 作品：src/pages/works.html
- 关于：src/pages/about.html
- 项目详情：src/pages/channel2000.html
- 文章：src/pages/about-this-space.html
- 共用导航和页脚：scripts/build.mjs
- 样式：public/assets/site.css
- 菜单、入场动画与星门：public/assets/site.js

提交到 main 后，GitHub Actions 自动构建并发布。无需安装依赖。
本地运行 node scripts/build.mjs，然后 node scripts/preview.mjs。

## 私有日志
连续点击页脚星星三次打开口令框。口令在浏览器本地派生密钥、解锁一个加密的跳转地址，没有任何日志内容存放于本站。
日志仍由 GitHub 私有仓库的登录与权限保护。星门只是个人入口，不构成 GitHub 的访问授权。
口令原文不会进入公开仓库。public/assets/gate.json 仅包含盐值、加密参数和密文。

