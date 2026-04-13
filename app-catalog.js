(function () {
  "use strict";

  var S = window.AmazonNavStorage;
  var M = window.AmazonNavMerge;
  var Editor = window.AmazonNavToolEditor;

  if (!S || !M || !Editor) {
    console.error("catalog 需要 storage、data-merge、tool-editor");
    return;
  }

  function categoriesSorted() {
    return M.getMergedCategories().slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
  }

  function typeLabel(type) {
    var map = {
      site: "网站",
      extension: "插件",
      desktop: "桌面",
      app: "App",
      backend: "后台",
      tip: "技巧",
    };
    return map[type] || type;
  }

  function badgeClass(type) {
    return "badge badge--" + (type || "site");
  }

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

  function updatePendingBadge() {
    var n = S.getPendingBuiltinCount();
    var eln = document.getElementById("nav-pending-badge");
    if (eln) {
      eln.textContent = n > 0 ? "(" + n + ")" : "";
      eln.style.display = n > 0 ? "inline" : "none";
    }
  }

  function renderToolRow(tool) {
    var isCustom = !!tool._isCustom;
    var main = el("div", { className: "tool-row__main" });
    var h = el("h3", {});
    h.appendChild(el("span", { className: badgeClass(tool.type), text: typeLabel(tool.type) }));
    h.appendChild(document.createTextNode(" " + tool.name));
    main.appendChild(h);
    if (tool.subFunction) {
      main.appendChild(el("p", { className: "tool-row__sub", text: tool.subFunction }));
    }
    main.appendChild(el("p", { className: "tool-row__desc", text: tool.description || "" }));

    if (tool.url) {
      main.appendChild(
        el("p", { className: "tool-row__sub" }, [
          el("a", {
            href: tool.url,
            target: "_blank",
            rel: "noopener noreferrer",
            text: tool.url,
          }),
        ])
      );
    } else {
      main.appendChild(
        el("p", {
          className: "tool-row__sub",
          text: "无可用链接（插件/桌面/后台等请按说明自行安装或进入后台）。",
        })
      );
    }

    var actions = el("div", { className: "tool-row__actions" });

    var btnEdit = el("button", {
      type: "button",
      className: "btn btn--ghost",
      text: "编辑",
    });
    btnEdit.addEventListener("click", function () {
      Editor.openToolEditor({
        toolId: tool.id,
        isCustom: isCustom,
        onSaved: function () {
          renderCatalog();
          updatePendingBadge();
        },
      });
    });
    actions.appendChild(btnEdit);

    if (isCustom) {
      var btnDel = el("button", { type: "button", className: "btn btn--danger", text: "删除" });
      btnDel.addEventListener("click", function () {
        if (!confirm("确定从库中删除该自定义工具？")) return;
        S.deleteCustomItem(tool.id);
        renderCatalog();
      });
      actions.appendChild(btnDel);
      actions.appendChild(
        el("span", { className: "badge", text: "自定义", title: "已在全量库中，无需再加入门户" })
      );
    } else if (tool.joinable) {
      function syncPinButton(btn, toolId) {
        var on = S.isFavorite(toolId);
        btn.textContent = on ? "已加入" : "加入门户";
        btn.className = on ? "btn btn--ghost" : "btn btn--primary";
      }
      var btn = el("button", { type: "button", "data-tool-id": tool.id });
      syncPinButton(btn, tool.id);
      btn.addEventListener("click", function () {
        S.toggleFavoriteId(tool.id);
        syncPinButton(btn, tool.id);
      });
      actions.appendChild(btn);
    } else {
      actions.appendChild(
        el("span", { className: "badge", text: "不可加入门户", title: "无有效链接或未开启加入门户" })
      );
    }

    return el("div", { className: "tool-row", id: "tool-" + tool.id }, [main, actions]);
  }

  function renderCategorySection(cat) {
    var section = el("section", {
      className: "catalog-category",
      id: "cat-" + cat.id,
    });
    var head = el("div", { className: "catalog-category__head" });
    head.appendChild(el("h2", { className: "section-title", text: cat.name }));
    var btnIntro = el("button", {
      type: "button",
      className: "btn btn--ghost btn--small",
      text: "编辑简介",
    });
    btnIntro.addEventListener("click", function () {
      Editor.openCategoryIntroEditor(cat.id, function () {
        renderCatalog();
      });
    });
    head.appendChild(btnIntro);
    section.appendChild(head);

    var introWrap = el("div", { className: "catalog-category__intro" });
    (cat.intro || []).forEach(function (para) {
      introWrap.appendChild(el("p", { text: para }));
    });
    section.appendChild(introWrap);

    var list = M.toolsForCategoryMerged(cat.id);
    list.forEach(function (t) {
      section.appendChild(renderToolRow(t));
    });
    return section;
  }

  function renderToc(container) {
    container.innerHTML = "";
    var inner = el("div", { className: "catalog-toc__inner" });
    categoriesSorted().forEach(function (c) {
      inner.appendChild(el("a", { href: "#cat-" + c.id, text: c.name }));
    });
    container.appendChild(el("nav", { className: "catalog-toc", "aria-label": "分类导航" }, [inner]));
  }

  function renderCatalog() {
    var root = document.getElementById("catalog-root");
    var tocHost = document.getElementById("catalog-toc-host");
    if (!root) return;
    root.innerHTML = "";
    if (tocHost) renderToc(tocHost);
    categoriesSorted().forEach(function (c) {
      root.appendChild(renderCategorySection(c));
    });
    updatePendingBadge();
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderCatalog();
  });
})();
