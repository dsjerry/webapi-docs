---
title: WebAuthn / Passkeys
description: 浏览器原生的无密码登录模块
---

# WebAuthn / Passkeys

浏览器原生的强身份认证 API。基于公私钥 + 设备生物识别，**彻底替代密码**。Apple、Google、Microsoft 一致推 Passkeys，新项目登录流程优先选它。

## 模块内容

- [概述](./overview) — WebAuthn 是什么，为什么 Passkeys 终结密码时代
- [核心概念](./overview#核心概念) — Authenticator、Relying Party、Attestation、Assertion
- [基础用法](./basic) — 注册凭证、登录验证
- [进阶用法](./advanced) — 自动登录、条件 UI、多设备同步、降级方案
- [实战：完整登录流程](./practical) — 端到端的注册 + 登录最小可用系统
