# AAZ AI 開發工作流程指南

本專案使用 AAZ AI 開發工作流程，透過 slash commands 進行 AI 輔助開發。

---

## 工作流程總覽

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ aaz:spec │ -> │ aaz:plan │ -> │ aaz:impl │
│ 建立規格  │    │ 建立計劃  │    │ 依計劃實作│
└──────────┘    └──────────┘    └──────────┘
                                     │
                                     ▼
               ┌────────────┐   ┌──────────┐
               │ aaz:commit │ <-│aaz:review│
               │ 提交變更   │   │ 程式碼審查│
               └────────────┘   └──────────┘

隨時可用: /aaz:status 查看當前任務狀態
```

---

## 指令說明

### /aaz:spec [JIRA_ID]

討論需求並建立規格文件。

**範例：**
```bash
/aaz:spec              # 從 branch 自動偵測或詢問
/aaz:spec AAZ-1234     # 從 JIRA 取得需求
/aaz:spec AT-5678      # 支援 AT- 前綴
```

**產出：** `tasks/{task-name}/spec.md`

---

### /aaz:plan [PHASE] [SPEC_PATH]

針對特定 Phase 建立實作計劃。

**範例：**
```bash
/aaz:plan 9A                              # 自動偵測 spec
/aaz:plan 9A tasks/AAZ-1234/spec.md       # 指定 spec 路徑
```

**產出：** `tasks/{task-name}/phase{XX}-implementation-plan.md`

---

### /aaz:impl [PLAN_PATH]

依據實作計劃執行程式碼變更 (TDD 流程)。

**範例：**
```bash
/aaz:impl                                              # 詢問計劃
/aaz:impl tasks/AAZ-1234/phase9a-implementation-plan.md
```

**流程：** 寫測試 → 實作 → 重構

---

### /aaz:review [SCOPE]

依據規範審查程式碼，產生評分報告。

**範例：**
```bash
/aaz:review                    # 預設: staged 檔案
/aaz:review staged             # git staged 檔案
/aaz:review BonusService/      # 指定目錄
```

**產出：** `tasks/{task-name}/review-report.md`

**評分標準：**
| 等級 | 分數 | 說明 |
|------|------|------|
| A | 90+ | 優秀 |
| B | 80+ | 良好，可提交 |
| C | 70+ | 需改進 |
| D | 60+ | 需大幅改進 |
| F | <60 | 不合格 |

**要求：** B 級 (80分) 以上才能提交

---

### /aaz:commit

確認變更後提交 (檢查 Review 評分 + Tidy First)。

**範例：**
```bash
/aaz:commit
```

**檢查項目：**
- Review 分數 >= 80 分
- 遵循 Tidy First 原則

---

### /aaz:status

查看當前任務狀態總覽。

**範例：**
```bash
/aaz:status
```

**顯示內容：** Spec/Plan/Review/Git 狀態 + 建議下一步

---

## 快速開始

```bash
# 新任務
/aaz:spec AAZ-1234

# 查看狀態
/aaz:status

# 開始實作
/aaz:plan 1 → /aaz:impl → /aaz:review → /aaz:commit
```

---

## 溝通語言規範

| 場景 | 語言 |
|------|------|
| AI 與使用者對話 | 繁體中文 |
| 產出文件 (spec, plan, review) | 繁體中文 |
| 程式碼註解 / XML Doc | 英文 |

---

## 相關文件

- [Clean Architecture 指南](zh-TW/)
- [AI 開發標準](ai-development-standards.md)
- [Code Review 檢查清單](code-review-checklist.md)
