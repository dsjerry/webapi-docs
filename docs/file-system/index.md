---
title: File System Access API
description: 浏览器读写本地文件系统模块
---

# File System Access API

让浏览器**真正读写用户的本地文件**——不只是上传下载，是直接打开文件、修改保存。VS Code Web、Photopea、Excalidraw 都靠它。

## 模块内容

- [概述](./overview) — File System Access 是什么，和 `<input type=file>` 区别
- [核心概念](./overview#核心概念) — `FileSystemHandle`、权限、OPFS
- [基础用法](./basic) — 打开文件、保存文件、选择目录
- [进阶用法](./advanced) — 持久化句柄、OPFS、Drag & Drop 集成
- [实战：本地文本编辑器](./practical) — 仿 VS Code 的极简本地编辑器
