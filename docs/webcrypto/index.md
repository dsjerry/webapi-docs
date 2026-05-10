---
title: Web Crypto API
description: 浏览器原生加密模块
---

# Web Crypto API

浏览器内置的低层级加密接口。哈希、随机数、对称加密、非对称加密、数字签名一站式提供，全部由原生代码实现，比任何 JS 加密库都快、都安全。

## 模块内容

- [概述](./overview) — Web Crypto 是什么，和第三方加密库有什么区别
- [核心概念](./overview#核心概念) — `crypto` 对象、`SubtleCrypto`、CryptoKey、算法标识
- [基础用法](./basic) — 随机数、UUID、哈希、编码转换
- [进阶用法](./advanced) — 对称加密、非对称加密、签名验签、密钥导入导出
- [实战：端到端加密笔记](./practical) — 从零实现一个本地加密笔记应用
