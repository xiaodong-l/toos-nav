(function () {
  "use strict";

  var S = window.AmazonNavStorage;
  var M = window.AmazonNavMerge;

  if (!S || !M) return;

  var FIELDS = [
    { key: "name", label: "名称" },
    { key: "categoryId", label: "类别 ID" },
    { key: "url", label: "URL" },
    { key: "subFunction", label: "子功能" },
    { key: "description", label: "说明" },
    { key: "type", label: "类型" },
    { key: "joinable", label: "可加入门户" },
  ];

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (ch) {
      if (ch != null) node.appendChild(ch);
    });
    return node;
  }

  function fmt(v) {
    if (v === null || v === undefined) return "（空）";
    if (typeof v === "boolean") return v ? "是" : "否";
    return String(v);
  }

  function effectiveBefore(toolId) {
    return M.getEffectiveBuiltinTool(toolId);
  }

  function renderPendingList() {
    var root = document.getElementById("review-list");
    var countEl = document.getElementById("review-count");
    if (!root) return;

    var pending = S.getPendingBuiltinEdits();
    var ids = Object.keys(pending);
    if (countEl) countEl.textContent = String(ids.length);

    root.innerHTML = "";

    function syncNavBadge() {
      var n = S.getPendingBuiltinCount();
      var eln = document.getElementById("nav-pending-badge");
      if (eln) {
        eln.textContent = n > 0 ? "(" + n + ")" : "";
      }
    }

    if (ids.length === 0) {
      root.appendChild(
        el("p", { className: "review-empty", text: "暂无待审阅的内置工具修改。" })
      );
      syncNavBadge();
      return;
    }

    ids.forEach(function (toolId) {
      var entry = pending[toolId];
      var snap = entry && entry.snapshot;
      if (!snap) return;

      var base = M.getBaseTool(toolId);
      var before = effectiveBefore(toolId);
      var card = el("article", { className: "review-card" });
      card.appendChild(
        el("h3", { className: "review-card__title", text: (base && base.name) || toolId })
      );
      card.appendChild(
        el("p", { className: "review-card__meta", text: "ID: " + toolId + " · 提交于 " + (entry.updatedAt || "") })
      );

      var diffWrap = el("div", { className: "review-diff" });
      FIELDS.forEach(function (f) {
        var bv = before ? before[f.key] : undefined;
        var sv = snap[f.key];
        if (f.key === "url") {
          bv = bv == null ? null : bv;
          sv = sv == null ? null : sv;
        }
        if (f.key === "joinable") {
          bv = !!bv;
          sv = !!sv;
        }
        if (f.key === "description") {
          bv = bv == null ? "" : String(bv);
          sv = sv == null ? "" : String(sv);
        }
        if (f.key === "subFunction") {
          bv = bv == null ? "" : String(bv);
          sv = sv == null ? "" : String(sv);
        }
        if (fmt(bv) === fmt(sv)) return;

        var row = el("div", { className: "review-diff__row" });
        row.appendChild(el("span", { className: "review-diff__label", text: f.label }));
        var vals = el("div", { className: "review-diff__vals" });
        vals.appendChild(
          el("div", { className: "review-diff__before" }, [
            el("span", { className: "review-diff__tag", text: "当前生效" }),
            document.createTextNode(" " + fmt(bv)),
          ])
        );
        vals.appendChild(
          el("div", { className: "review-diff__after" }, [
            el("span", { className: "review-diff__tag", text: "拟改" }),
            document.createTextNode(" " + fmt(sv)),
          ])
        );
        row.appendChild(vals);
        diffWrap.appendChild(row);
      });

      if (!diffWrap.childNodes.length) {
        diffWrap.appendChild(
          el("p", { className: "review-diff__empty", text: "与当前生效相比无字段差异；仍可直接采纳以确认或丢弃。" })
        );
      }

      card.appendChild(diffWrap);

      var actions = el("div", { className: "review-card__actions" });
      var btnApprove = el("button", { type: "button", className: "btn btn--primary", text: "采纳" });
      btnApprove.addEventListener("click", function () {
        if (!base) {
          alert("基准数据中找不到该工具，无法采纳。");
          return;
        }
        if (!confirm("采纳后将覆盖当前生效内容，确定？")) return;
        S.approvePendingBuiltin(toolId, base);
        renderPendingList();
        alert("已采纳。");
      });
      var btnDiscard = el("button", { type: "button", className: "btn btn--danger", text: "丢弃" });
      btnDiscard.addEventListener("click", function () {
        if (!confirm("确定丢弃该条待审阅修改？")) return;
        S.removeBuiltinPending(toolId);
        renderPendingList();
      });
      actions.appendChild(btnApprove);
      actions.appendChild(btnDiscard);
      card.appendChild(actions);

      root.appendChild(card);
    });

    syncNavBadge();
  }

  function setupApproveAll() {
    var btn = document.getElementById("btn-approve-all");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var pending = S.getPendingBuiltinEdits();
      var ids = Object.keys(pending);
      if (ids.length === 0) return;
      if (!confirm("将采纳全部 " + ids.length + " 条待审阅修改，确定？")) return;
      S.approveAllPending(M.baseById);
      renderPendingList();
      alert("已全部采纳。");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderPendingList();
    setupApproveAll();
  });
})();
