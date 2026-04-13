(function () {
  "use strict";

  var S = window.AmazonNavStorage;
  var M = window.AmazonNavMerge;
  var Editor = window.AmazonNavToolEditor;

  if (!S || !M) {
    console.error("portal 需要 AmazonNavStorage 与 AmazonNavMerge");
    return;
  }

  var UNCATEGORIZED_ID = "__uncategorized__";

  function getSortedCats() {
    return M.getMergedCategories()
      .slice()
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
  }

  var catById = Object.create(null);
  getSortedCats().forEach(function (c) {
    catById[c.id] = c;
  });

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
        else if (k === "html") node.innerHTML = attrs[k];
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

  function renderCard(tool, opts) {
    var stale = opts && opts.stale;
    var grouped = opts && opts.grouped;
    var card = el("article", { className: "card" });
    var titleRow = el("h3", { className: "card__title" });
    titleRow.appendChild(el("span", { className: badgeClass(tool.type), text: typeLabel(tool.type) }));
    titleRow.appendChild(document.createTextNode(" " + (tool.name || "")));

    var meta = el("div", { className: "card__meta" });
    if (stale) {
      meta.textContent = "已失效的收藏";
    } else if (grouped) {
      var bits = [];
      if (tool.subFunction) bits.push(tool.subFunction);
      bits.push(typeLabel(tool.type));
      meta.textContent = bits.join(" · ");
    } else {
      var cat = catById[tool.categoryId];
      meta.textContent = (cat && cat.name) || tool.categoryId;
      if (tool.subFunction) meta.textContent += " · " + tool.subFunction;
    }

    var descText = tool.description != null ? tool.description : tool.note || "";
    var desc = el("p", { className: "card__desc", text: descText });

    var actions = el("div", { className: "card__actions" });

    if (!stale && tool.url) {
      actions.appendChild(
        el("a", {
          className: "btn btn--primary",
          href: tool.url,
          target: "_blank",
          rel: "noopener noreferrer",
          text: "打开链接",
        })
      );
    }

    if (Editor && !stale) {
      var isCustom = !!tool._isCustom;
      var editBtn = el("button", {
        type: "button",
        className: "btn btn--ghost",
        text: "编辑",
      });
      editBtn.addEventListener("click", function () {
        Editor.openToolEditor({
          toolId: tool.id,
          isCustom: isCustom,
          onSaved: function () {
            render();
            updatePendingBadge();
          },
        });
      });
      actions.appendChild(editBtn);
    }

    var removeBtn = el("button", {
      type: "button",
      className: "btn btn--danger",
      text: stale ? "移除" : tool._isCustom ? "删除" : "从门户移除",
    });
    removeBtn.addEventListener("click", function () {
      if (tool._isCustom) {
        if (!confirm("确定删除该自定义工具？")) return;
        S.deleteCustomItem(tool.id);
      } else {
        S.removeFavoriteId(tool.id);
      }
      render();
    });
    actions.appendChild(removeBtn);

    card.appendChild(titleRow);
    card.appendChild(meta);
    card.appendChild(desc);
    if (stale) {
      card.appendChild(
        el("p", {
          className: "stale-banner",
          text: "条目已失效，请从「全部工具」重新添加。",
        })
      );
    }
    card.appendChild(actions);
    return card;
  }

  function renderStalePlaceholder(favId) {
    var tool = {
      id: favId,
      name: favId,
      type: "tip",
      categoryId: "",
      description: "内置数据中已找不到该工具 ID。",
    };
    return renderCard(tool, { stale: true, grouped: true });
  }

  function renderCustomCard(item, opts) {
    var t = M.customItemToTool(item);
    t._isCustom = true;
    t.description = item.description || item.note || "";
    return renderCard(t, opts);
  }

  function ensureBucket(buckets, id) {
    if (!buckets[id]) buckets[id] = { tools: [], customs: [] };
    return buckets[id];
  }

  function appendCategoryBlock(container, title, tools, customs) {
    if (tools.length === 0 && customs.length === 0) return;
    var section = el("section", { className: "portal-category" });
    section.appendChild(el("h3", { className: "portal-category__title", text: title }));
    var grid = el("div", { className: "card-grid" });
    tools.forEach(function (t) {
      if (!t._isCustom) t = Object.assign({}, t, { _isCustom: false });
      grid.appendChild(renderCard(t, { grouped: true }));
    });
    customs.forEach(function (c) {
      grid.appendChild(renderCustomCard(c, { grouped: true }));
    });
    section.appendChild(grid);
    container.appendChild(section);
  }

  function render() {
    var sortedCategories = getSortedCats();
    catById = Object.create(null);
    sortedCategories.forEach(function (c) {
      catById[c.id] = c;
    });

    var root = document.getElementById("portal-by-category");
    var empty = document.getElementById("portal-empty");
    if (!root || !empty) return;

    root.innerHTML = "";
    var favIds = S.getFavoriteIds();
    var customs = S.getCustomItems();

    var hasAny = favIds.length > 0 || customs.length > 0;
    empty.style.display = hasAny ? "none" : "block";
    root.style.display = hasAny ? "block" : "none";

    if (!hasAny) {
      updatePendingBadge();
      return;
    }

    var buckets = Object.create(null);
    ensureBucket(buckets, UNCATEGORIZED_ID);
    sortedCategories.forEach(function (c) {
      ensureBucket(buckets, c.id);
    });

    var staleFavIds = [];

    favIds.forEach(function (fid) {
      var merged = M.getMergedToolById(fid);
      if (!merged) {
        staleFavIds.push(fid);
        return;
      }
      if (merged._isCustom) {
        var raw = customs.filter(function (x) { return x.id === fid; })[0];
        if (raw) {
          var cid =
            raw.categoryId && catById[raw.categoryId] ? raw.categoryId : UNCATEGORIZED_ID;
          ensureBucket(buckets, cid).customs.push(raw);
        }
        return;
      }
      var cid = merged.categoryId;
      if (!catById[cid]) {
        ensureBucket(buckets, UNCATEGORIZED_ID).tools.push(merged);
      } else {
        ensureBucket(buckets, cid).tools.push(Object.assign({}, merged, { _isCustom: false }));
      }
    });

    customs.forEach(function (c) {
      if (favIds.indexOf(c.id) >= 0) return;
      var cid = c.categoryId && catById[c.categoryId] ? c.categoryId : UNCATEGORIZED_ID;
      ensureBucket(buckets, cid).customs.push(c);
    });

    sortedCategories.forEach(function (c) {
      var b = buckets[c.id];
      if (!b) return;
      appendCategoryBlock(root, c.name, b.tools, b.customs);
    });

    var uncat = buckets[UNCATEGORIZED_ID];
    if (uncat && (uncat.tools.length > 0 || uncat.customs.length > 0)) {
      appendCategoryBlock(root, "未分类", uncat.tools, uncat.customs);
    }

    if (staleFavIds.length > 0) {
      var section = el("section", { className: "portal-category" });
      section.appendChild(
        el("h3", { className: "portal-category__title", text: "失效的收藏" })
      );
      var grid = el("div", { className: "card-grid" });
      staleFavIds.forEach(function (fid) {
        grid.appendChild(renderStalePlaceholder(fid));
      });
      section.appendChild(grid);
      root.appendChild(section);
    }

    updatePendingBadge();
  }

  function setupCategorySelect() {
    var sel = document.getElementById("custom-category");
    if (!sel) return;
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", text: "请选择类别" }));
    getSortedCats().forEach(function (c) {
      sel.appendChild(el("option", { value: c.id, text: c.name }));
    });
  }

  function setupForm() {
    var form = document.getElementById("custom-form");
    if (!form) return;
    var err = document.getElementById("custom-form-error");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (err) err.textContent = "";
      var categoryEl = document.getElementById("custom-category");
      var categoryId = (categoryEl && categoryEl.value) || "";
      var name = (document.getElementById("custom-name") || {}).value || "";
      var url = (document.getElementById("custom-url") || {}).value || "";
      var note = (document.getElementById("custom-note") || {}).value || "";
      name = name.trim();
      url = url.trim();
      if (!categoryId) {
        if (err) err.textContent = "请选择类别。";
        return;
      }
      if (!name) {
        if (err) err.textContent = "请填写名称。";
        return;
      }
      if (!S.validateHttpUrl(url)) {
        if (err) err.textContent = "请输入以 http:// 或 https:// 开头的有效 URL。";
        return;
      }
      S.addCustomItem({
        id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        name: name,
        url: url,
        description: note.trim(),
        note: note.trim(),
        categoryId: categoryId,
        subFunction: "",
        type: "site",
        addedAt: new Date().toISOString(),
      });
      form.reset();
      setupCategorySelect();
      render();
    });
  }

  function setupBackup() {
    var exportBtn = document.getElementById("btn-export");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        S.downloadExport("amazon-nav-backup.json");
      });
    }
    var importInput = document.getElementById("import-file");
    var importMode = document.getElementById("import-mode");
    if (importInput) {
      importInput.addEventListener("change", function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            S.importBackup(String(reader.result || ""), {
              mode: importMode && importMode.value === "replace" ? "replace" : "merge",
            });
            render();
            alert("导入成功。");
          } catch (e) {
            alert("导入失败：" + (e && e.message ? e.message : String(e)));
          }
          importInput.value = "";
        };
        reader.readAsText(file, "utf-8");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupCategorySelect();
    render();
    setupForm();
    setupBackup();
  });
})();
