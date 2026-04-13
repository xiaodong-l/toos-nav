(function () {
  "use strict";

  var S = window.AmazonNavStorage;
  var M = window.AmazonNavMerge;

  if (!S || !M) return;

  var TYPE_OPTIONS = [
    { value: "site", label: "网站" },
    { value: "extension", label: "插件" },
    { value: "desktop", label: "桌面" },
    { value: "app", label: "App" },
    { value: "backend", label: "后台" },
    { value: "tip", label: "技巧" },
  ];

  var modalEl = null;
  var backdropEl = null;
  var onCloseCallback = null;

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

  function closeModal() {
    if (backdropEl) {
      backdropEl.style.display = "none";
      backdropEl.setAttribute("aria-hidden", "true");
    }
    if (onCloseCallback) {
      var cb = onCloseCallback;
      onCloseCallback = null;
      cb();
    }
  }

  function ensureModal() {
    if (modalEl) return;
    backdropEl = el("div", {
      className: "modal-backdrop",
      id: "tool-editor-backdrop",
      "aria-hidden": "true",
    });
    backdropEl.addEventListener("click", function (e) {
      if (e.target === backdropEl) closeModal();
    });

    modalEl = el("div", {
      className: "modal-dialog",
      id: "tool-editor-dialog",
      role: "dialog",
      "aria-modal": "true",
    });

    backdropEl.appendChild(modalEl);
    document.body.appendChild(backdropEl);
  }

  function fillCategorySelect(select, currentId) {
    select.innerHTML = "";
    var cats = M.getMergedCategories().slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    cats.forEach(function (c) {
      select.appendChild(el("option", { value: c.id, text: c.name }));
    });
    select.value = currentId || (cats[0] && cats[0].id) || "";
  }

  function buildFormFields(isCustom, snapshot) {
    var frag = document.createDocumentFragment();

    var nameRow = el("div", { className: "form-row" });
    nameRow.appendChild(el("label", { for: "te-name", text: "名称" }));
    nameRow.appendChild(
      el("input", { id: "te-name", type: "text", name: "name", required: "required" })
    );

    var catRow = el("div", { className: "form-row" });
    catRow.appendChild(el("label", { for: "te-category", text: "类别" }));
    var catSel = el("select", { id: "te-category", name: "categoryId", required: "required" });
    fillCategorySelect(catSel, snapshot.categoryId);
    catRow.appendChild(catSel);

    var urlRow = el("div", { className: "form-row" });
    urlRow.appendChild(el("label", { for: "te-url", text: "URL（可空：插件/后台等）" }));
    urlRow.appendChild(
      el("input", { id: "te-url", type: "text", name: "url", placeholder: "https:// 或留空" })
    );

    var subRow = el("div", { className: "form-row" });
    subRow.appendChild(el("label", { for: "te-sub", text: "子功能 / 标签" }));
    subRow.appendChild(el("input", { id: "te-sub", type: "text", name: "subFunction" }));

    var descRow = el("div", { className: "form-row" });
    descRow.appendChild(el("label", { for: "te-desc", text: "说明" }));
    descRow.appendChild(el("textarea", { id: "te-desc", name: "description", rows: "4" }));

    var typeRow = el("div", { className: "form-row" });
    typeRow.appendChild(el("label", { for: "te-type", text: "类型" }));
    var typeSel = el("select", { id: "te-type", name: "type" });
    TYPE_OPTIONS.forEach(function (o) {
      typeSel.appendChild(el("option", { value: o.value, text: o.label }));
    });
    typeRow.appendChild(typeSel);

    var joinRow = el("div", { className: "form-row tool-editor__join-row" });
    var joinCb = el("input", {
      id: "te-join",
      type: "checkbox",
      name: "joinable",
    });
    joinRow.appendChild(joinCb);
    joinRow.appendChild(
      el("label", { for: "te-join", text: " 允许加入门户（需有效 http(s) 链接）", className: "tool-editor__inline-label" })
    );

    frag.appendChild(nameRow);
    frag.appendChild(catRow);
    frag.appendChild(urlRow);
    frag.appendChild(subRow);
    frag.appendChild(descRow);
    frag.appendChild(typeRow);
    if (!isCustom) frag.appendChild(joinRow);

    return {
      fragment: frag,
      ids: {
        name: "te-name",
        category: "te-category",
        url: "te-url",
        sub: "te-sub",
        desc: "te-desc",
        type: "te-type",
        join: "te-join",
      },
    };
  }

  function readSnapshotFromForm(isCustom) {
    var name = (document.getElementById("te-name") || {}).value || "";
    var categoryId = (document.getElementById("te-category") || {}).value || "";
    var urlRaw = (document.getElementById("te-url") || {}).value || "";
    var subFunction = (document.getElementById("te-sub") || {}).value || "";
    var description = (document.getElementById("te-desc") || {}).value || "";
    var type = (document.getElementById("te-type") || {}).value || "site";
    var joinable = isCustom ? false : !!(document.getElementById("te-join") || {}).checked;
    var url = urlRaw.trim() === "" ? null : urlRaw.trim();
    return {
      name: name.trim(),
      categoryId: categoryId,
      url: url,
      description: description,
      subFunction: subFunction.trim(),
      type: type,
      joinable: joinable,
    };
  }

  function applySnapshotToForm(snapshot, isCustom) {
    document.getElementById("te-name").value = snapshot.name || "";
    fillCategorySelect(document.getElementById("te-category"), snapshot.categoryId);
    document.getElementById("te-url").value = snapshot.url || "";
    document.getElementById("te-sub").value = snapshot.subFunction || "";
    document.getElementById("te-desc").value =
      snapshot.description != null ? snapshot.description : snapshot.note || "";
    document.getElementById("te-type").value = snapshot.type || "site";
    var j = document.getElementById("te-join");
    if (j) j.checked = !!snapshot.joinable;
  }

  function openToolEditor(opts) {
    ensureModal();
    var toolId = opts.toolId;
    var isCustom = !!opts.isCustom;
    var titleText = opts.title || (isCustom ? "编辑自定义工具" : "编辑内置工具（保存后待审阅）");

    modalEl.innerHTML = "";
    modalEl.appendChild(el("h2", { className: "modal-dialog__title", id: "tool-editor-title", text: titleText }));

    var snapshot;
    if (isCustom) {
      var items = S.getCustomItems();
      var item = items.filter(function (x) { return x.id === toolId; })[0];
      if (!item) {
        alert("找不到该自定义工具");
        return;
      }
      var t = M.customItemToTool(item);
      snapshot = {
        name: t.name,
        categoryId: t.categoryId,
        url: t.url,
        description: item.description || item.note || "",
        subFunction: t.subFunction || "",
        type: t.type || "site",
        joinable: false,
      };
    } else {
      snapshot = M.getFormSnapshotForBuiltin(toolId);
    }

    var built = buildFormFields(isCustom, snapshot);
    var form = el("form", { className: "tool-editor-form", id: "tool-editor-form" });
    form.appendChild(built.fragment);

    var err = el("p", { className: "form-error", id: "tool-editor-error", role: "alert" });
    form.appendChild(err);

    var actions = el("div", { className: "modal-dialog__actions" });
    actions.appendChild(
      el("button", { type: "button", className: "btn btn--ghost", text: "取消" })
    ).addEventListener("click", closeModal);
    actions.appendChild(
      el("button", { type: "submit", className: "btn btn--primary", text: isCustom ? "保存" : "提交审阅" })
    );
    form.appendChild(actions);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.textContent = "";
      var snap = readSnapshotFromForm(isCustom);
      if (!snap.name) {
        err.textContent = "请填写名称。";
        return;
      }
      if (!snap.categoryId) {
        err.textContent = "请选择类别。";
        return;
      }
      if (snap.joinable && snap.url && !S.validateHttpUrl(snap.url)) {
        err.textContent = "「加入门户」开启时，请填写有效的 http(s) URL。";
        return;
      }
      if (snap.joinable && !snap.url) {
        err.textContent = "开启加入门户时需填写 URL，或关闭该选项。";
        return;
      }
      if (snap.url && !S.validateHttpUrl(snap.url)) {
        err.textContent = "URL 需以 http:// 或 https:// 开头，或留空。";
        return;
      }

      try {
        if (isCustom) {
          S.updateCustomItem(toolId, {
            name: snap.name,
            categoryId: snap.categoryId,
            url: snap.url || "",
            description: snap.description,
            subFunction: snap.subFunction,
            type: snap.type,
          });
        } else {
          S.saveBuiltinPendingSnapshot(toolId, snap);
        }
        closeModal();
        if (opts.onSaved) opts.onSaved();
      } catch (ex) {
        err.textContent = (ex && ex.message) || String(ex);
      }
    });

    modalEl.appendChild(form);
    applySnapshotToForm(snapshot, isCustom);

    backdropEl.style.display = "flex";
    backdropEl.setAttribute("aria-hidden", "false");
    onCloseCallback = opts.onClose || null;
    document.getElementById("te-name").focus();
  }

  function openCategoryIntroEditor(catId, onSaved) {
    onCloseCallback = null;
    ensureModal();
    var cats = M.getBaseData().categories || [];
    var base = cats.filter(function (c) { return c.id === catId; })[0];
    if (!base) return;
    var cov = S.getCategoryOverrides()[catId];
    var intro = cov && Array.isArray(cov.intro) ? cov.intro.slice() : (base.intro || []).slice();

    modalEl.innerHTML = "";
    modalEl.appendChild(
      el("h2", { className: "modal-dialog__title", text: "编辑分类说明 · " + base.name })
    );
    var p = el("p", {
      className: "modal-dialog__hint",
      text: "每段一行，空行分段。保存后立即在全量页与门户生效（无需审阅）。",
    });
    modalEl.appendChild(p);
    var ta = el("textarea", {
      className: "tool-editor__intro-textarea",
      id: "cat-intro-ta",
      rows: "10",
    });
    ta.value = intro.join("\n\n");
    modalEl.appendChild(ta);

    var err = el("p", { className: "form-error", id: "cat-intro-err" });
    modalEl.appendChild(err);

    var actions = el("div", { className: "modal-dialog__actions" });
    var cancel = el("button", { type: "button", className: "btn btn--ghost", text: "取消" });
    cancel.addEventListener("click", closeModal);
    var save = el("button", { type: "button", className: "btn btn--primary", text: "保存" });
    save.addEventListener("click", function () {
      err.textContent = "";
      var raw = ta.value || "";
      var paras = raw
        .split(/\n\s*\n/)
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      S.updateCategoryOverride(catId, { intro: paras });
      closeModal();
      if (onSaved) onSaved();
    });
    actions.appendChild(cancel);
    actions.appendChild(save);
    modalEl.appendChild(actions);

    backdropEl.style.display = "flex";
    backdropEl.setAttribute("aria-hidden", "false");
    ta.focus();
  }

  window.AmazonNavToolEditor = {
    openToolEditor: openToolEditor,
    openCategoryIntroEditor: openCategoryIntroEditor,
    closeModal: closeModal,
  };
})();
