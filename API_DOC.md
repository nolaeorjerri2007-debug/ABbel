# 语义调音台 MVP - 前后端 API 联调契约

前端所有的网络请求请严格按照以下契约调用。

## 🟢 接口一：首解析引擎 (ABbel-A)
- **触发时机**：首页跳转到工作台，工作台首次加载时。
- **请求方式**：POST
- **URL**：/dify-api/v1/workflows/run
- **Headers**：
  - Authorization: Bearer app-ohequ4QpaSvQGIcYx7zGcOyc
  - Content-Type: application/json
- **入参 (Body)**：
  ```json
  {
    "inputs": {
      "input_text": "这里填入从首页传过来的 userQuery 变量"
    },
    "response_mode": "blocking",
    "user": "web-user"
  }

- **出参结构**：
  后端返回的标准结构中，核心数据在 `data.outputs.text` 字段里。你需要先获取这个值，如果是字符串，请执行 `JSON.parse()` 解析。解析后必定包含以下结构：
  - `scores`: 10 个维度的初始分数。
  - `draft`: 首版文案字符串。