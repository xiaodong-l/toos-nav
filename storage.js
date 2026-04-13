(function () {
  "use strict";

  var STORAGE_PREFIX = "amazonNav:";
  var KEY_FAVORITES = STORAGE_PREFIX + "favoriteIds";
  var KEY_CUSTOM = STORAGE_PREFIX + "customItems";
  var KEY_PENDING = STORAGE_PREFIX + "pendingBuiltinEdits";
  var KEY_APPROVED = STORAGE_PREFIX + "approvedBuiltinOverrides";
  var KEY_CATEGORY = STORAGE_PREFIX + "categoryOverrides";
  var EXPORT_VERSION = 2;

  var EDITABLE_BUILTIN_FIELDS = [
    "name",
    "categoryId",
    "url",
    "description",
    "subFunction",
    "type",
    "joinable",
  ];

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (e) {
      return fallback;
    }
  }

  function getFavoriteIds() {
    var raw = localStorage.getItem(KEY_FAVORITES);
    var arr = safeParse(raw, []);
    return Array.isArray(arr) ? arr.filter(function (id) { return typeof id === "string"; }) : [];
  }

  function setFavoriteIds(ids) {
    var uniq = [];
    var seen = Object.create(null);
    ids.forEach(function (id) {
      if (typeof id !== "string" || !id || seen[id]) return;
      seen[id] = true;
      uniq.push(id);
    });
    localStorage.setItem(KEY_FAVORITES, JSON.stringify(uniq));
    return uniq;
  }

  function toggleFavoriteId(toolId) {
    var ids = getFavoriteIds();
    var i = ids.indexOf(toolId);
    if (i >= 0) {
      ids.splice(i, 1);
    } else {
      ids.push(toolId);
    }
    setFavoriteIds(ids);
    return i < 0;
  }

  function isFavorite(toolId) {
    return getFavoriteIds().indexOf(toolId) >= 0;
  }

  function removeFavoriteId(toolId) {
    setFavoriteIds(getFavoriteIds().filter(function (id) { return id !== toolId; }));
  }

  function normalizeCustomItem(x) {
    if (!x || typeof x !== "object") return x;
    var desc =
      typeof x.description === "string"
        ? x.description
        : typeof x.note === "string"
          ? x.note
          : "";
    return {
      id: x.id,
      categoryId: typeof x.categoryId === "string" ? x.categoryId : "",
      name: typeof x.name === "string" ? x.name : "",
      url: typeof x.url === "string" ? x.url : "",
      description: desc,
      note: desc,
      subFunction: typeof x.subFunction === "string" ? x.subFunction : "",
      type: typeof x.type === "string" ? x.type : "site",
      joinable: x.joinable === true,
      addedAt: typeof x.addedAt === "string" ? x.addedAt : new Date().toISOString(),
    };
  }

  function getCustomItems() {
    var raw = localStorage.getItem(KEY_CUSTOM);
    var arr = safeParse(raw, []);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeCustomItem);
  }

  function setCustomItems(items) {
    localStorage.setItem(KEY_CUSTOM, JSON.stringify(items));
    return items;
  }

  function addCustomItem(item) {
    var normalized = normalizeCustomItem(item);
    var items = getCustomItems();
    items.push(normalized);
    setCustomItems(items);
    return normalized;
  }

  function updateCustomItem(id, partial) {
    var items = getCustomItems();
    var idx = items.findIndex(function (x) { return x.id === id; });
    if (idx < 0) throw new Error("找不到该自定义工具");
    var cur = items[idx];
    var next = normalizeCustomItem(
      Object.assign({}, cur, partial, { id: cur.id, addedAt: cur.addedAt })
    );
    items[idx] = next;
    setCustomItems(items);
    return next;
  }

  function deleteCustomItem(id) {
    setCustomItems(getCustomItems().filter(function (x) { return x.id !== id; }));
  }

  function getPendingBuiltinEdits() {
    var raw = localStorage.getItem(KEY_PENDING);
    var o = safeParse(raw, {});
    return o && typeof o === "object" ? o : {};
  }

  function setPendingBuiltinEdits(obj) {
    localStorage.setItem(KEY_PENDING, JSON.stringify(obj));
    return obj;
  }

  function saveBuiltinPendingSnapshot(toolId, snapshot) {
    var p = getPendingBuiltinEdits();
    p[toolId] = {
      snapshot: snapshot,
      updatedAt: new Date().toISOString(),
    };
    setPendingBuiltinEdits(p);
  }

  function removeBuiltinPending(toolId) {
    var p = getPendingBuiltinEdits();
    delete p[toolId];
    setPendingBuiltinEdits(p);
  }

  function getApprovedBuiltinOverrides() {
    var raw = localStorage.getItem(KEY_APPROVED);
    var o = safeParse(raw, {});
    return o && typeof o === "object" ? o : {};
  }

  function setApprovedBuiltinOverrides(obj) {
    localStorage.setItem(KEY_APPROVED, JSON.stringify(obj));
    return obj;
  }

  function getCategoryOverrides() {
    var raw = localStorage.getItem(KEY_CATEGORY);
    var o = safeParse(raw, {});
    return o && typeof o === "object" ? o : {};
  }

  function setCategoryOverrides(obj) {
    localStorage.setItem(KEY_CATEGORY, JSON.stringify(obj));
    return obj;
  }

  function updateCategoryOverride(catId, partial) {
    var all = getCategoryOverrides();
    all[catId] = Object.assign({}, all[catId], partial);
    setCategoryOverrides(all);
    return all[catId];
  }

  function normalizeUrlField(v) {
    if (v == null || v === "") return null;
    return String(v).trim() || null;
  }

  function computeOverrideFromBase(base, snapshot) {
    var o = {};
    EDITABLE_BUILTIN_FIELDS.forEach(function (k) {
      var bv = base[k];
      var sv = snapshot[k];
      if (k === "url") {
        bv = normalizeUrlField(bv);
        sv = normalizeUrlField(sv);
      } else if (k === "joinable") {
        bv = !!bv;
        sv = !!sv;
      } else if (k === "description" || k === "subFunction") {
        bv = bv == null ? "" : String(bv);
        sv = sv == null ? "" : String(sv);
      } else {
        bv = bv == null ? "" : bv;
        sv = sv == null ? "" : sv;
      }
      if (sv !== bv) o[k] = snapshot[k];
    });
    return o;
  }

  function approvePendingBuiltin(toolId, baseTool) {
    var p = getPendingBuiltinEdits();
    var entry = p[toolId];
    if (!entry || !entry.snapshot) return false;
    var approved = getApprovedBuiltinOverrides();
    approved[toolId] = computeOverrideFromBase(baseTool, entry.snapshot);
    if (Object.keys(approved[toolId]).length === 0) delete approved[toolId];
    setApprovedBuiltinOverrides(approved);
    removeBuiltinPending(toolId);
    return true;
  }

  function approveAllPending(baseById) {
    var p = getPendingBuiltinEdits();
    var ids = Object.keys(p);
    ids.forEach(function (tid) {
      var base = baseById[tid];
      if (base) approvePendingBuiltin(tid, base);
    });
  }

  function getPendingBuiltinCount() {
    return Object.keys(getPendingBuiltinEdits()).length;
  }

  function validateHttpUrl(str) {
    if (typeof str !== "string") return false;
    var t = str.trim();
    if (!/^https?:\/\//i.test(t)) return false;
    try {
      var u = new URL(t);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function exportBackup() {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      favoriteIds: getFavoriteIds(),
      customItems: getCustomItems(),
      pendingBuiltinEdits: getPendingBuiltinEdits(),
      approvedBuiltinOverrides: getApprovedBuiltinOverrides(),
      categoryOverrides: getCategoryOverrides(),
    };
  }

  function exportBackupJson() {
    return JSON.stringify(exportBackup(), null, 2);
  }

  function importBackup(jsonText, opts) {
    var mode = (opts && opts.mode) || "merge";
    var data = safeParse(jsonText, null);
    if (!data || typeof data !== "object") {
      throw new Error("无效的 JSON");
    }
    var fav = data.favoriteIds;
    var cust = data.customItems;
    var pending = data.pendingBuiltinEdits;
    var approved = data.approvedBuiltinOverrides;
    var catOv = data.categoryOverrides;

    if (fav != null && !Array.isArray(fav)) throw new Error("favoriteIds 必须是数组");
    if (cust != null && !Array.isArray(cust)) throw new Error("customItems 必须是数组");

    if (mode === "replace") {
      if (Object.prototype.hasOwnProperty.call(data, "favoriteIds") && Array.isArray(fav)) {
        setFavoriteIds(fav.filter(function (id) { return typeof id === "string"; }));
      }
      if (Object.prototype.hasOwnProperty.call(data, "customItems") && Array.isArray(cust)) {
        setCustomItems(
          cust
            .filter(function (x) {
              return x && typeof x.id === "string" && typeof x.name === "string" && typeof x.url === "string";
            })
            .map(normalizeCustomItem)
        );
      }
      if (Object.prototype.hasOwnProperty.call(data, "pendingBuiltinEdits") && pending && typeof pending === "object") {
        setPendingBuiltinEdits(pending);
      } else if (mode === "replace" && !Object.prototype.hasOwnProperty.call(data, "pendingBuiltinEdits")) {
        setPendingBuiltinEdits({});
      }
      if (Object.prototype.hasOwnProperty.call(data, "approvedBuiltinOverrides") && approved && typeof approved === "object") {
        setApprovedBuiltinOverrides(approved);
      } else if (mode === "replace" && !Object.prototype.hasOwnProperty.call(data, "approvedBuiltinOverrides")) {
        setApprovedBuiltinOverrides({});
      }
      if (Object.prototype.hasOwnProperty.call(data, "categoryOverrides") && catOv && typeof catOv === "object") {
        setCategoryOverrides(catOv);
      } else if (mode === "replace" && !Object.prototype.hasOwnProperty.call(data, "categoryOverrides")) {
        setCategoryOverrides({});
      }
      return;
    }

    if (fav && fav.length) {
      var existing = getFavoriteIds();
      var seen = Object.create(null);
      existing.forEach(function (id) { seen[id] = true; });
      fav.forEach(function (id) {
        if (typeof id === "string" && id && !seen[id]) {
          seen[id] = true;
          existing.push(id);
        }
      });
      setFavoriteIds(existing);
    }

    if (cust && cust.length) {
      var items = getCustomItems();
      var byId = Object.create(null);
      items.forEach(function (x) { byId[x.id] = x; });
      cust.forEach(function (x) {
        if (!x || typeof x.id !== "string") return;
        if (typeof x.name !== "string" || typeof x.url !== "string") return;
        byId[x.id] = normalizeCustomItem(
          Object.assign({}, x, {
            description: typeof x.description === "string" ? x.description : x.note,
          })
        );
      });
      setCustomItems(Object.keys(byId).map(function (k) { return byId[k]; }));
    }

    if (pending && typeof pending === "object" && Object.keys(pending).length) {
      var mp = getPendingBuiltinEdits();
      Object.keys(pending).forEach(function (k) {
        if (pending[k] && pending[k].snapshot) mp[k] = pending[k];
      });
      setPendingBuiltinEdits(mp);
    }

    if (approved && typeof approved === "object" && Object.keys(approved).length) {
      var ma = getApprovedBuiltinOverrides();
      Object.keys(approved).forEach(function (k) {
        ma[k] = approved[k];
      });
      setApprovedBuiltinOverrides(ma);
    }

    if (catOv && typeof catOv === "object" && Object.keys(catOv).length) {
      var mc = getCategoryOverrides();
      Object.keys(catOv).forEach(function (k) {
        mc[k] = Object.assign({}, mc[k], catOv[k]);
      });
      setCategoryOverrides(mc);
    }
  }

  function downloadExport(filename) {
    var blob = new Blob([exportBackupJson()], { type: "application/json;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "amazon-nav-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.AmazonNavStorage = {
    KEY_FAVORITES: KEY_FAVORITES,
    KEY_CUSTOM: KEY_CUSTOM,
    KEY_PENDING: KEY_PENDING,
    KEY_APPROVED: KEY_APPROVED,
    KEY_CATEGORY: KEY_CATEGORY,
    EXPORT_VERSION: EXPORT_VERSION,
    EDITABLE_BUILTIN_FIELDS: EDITABLE_BUILTIN_FIELDS,
    getFavoriteIds: getFavoriteIds,
    setFavoriteIds: setFavoriteIds,
    toggleFavoriteId: toggleFavoriteId,
    isFavorite: isFavorite,
    removeFavoriteId: removeFavoriteId,
    getCustomItems: getCustomItems,
    setCustomItems: setCustomItems,
    addCustomItem: addCustomItem,
    updateCustomItem: updateCustomItem,
    deleteCustomItem: deleteCustomItem,
    normalizeCustomItem: normalizeCustomItem,
    getPendingBuiltinEdits: getPendingBuiltinEdits,
    setPendingBuiltinEdits: setPendingBuiltinEdits,
    saveBuiltinPendingSnapshot: saveBuiltinPendingSnapshot,
    removeBuiltinPending: removeBuiltinPending,
    getApprovedBuiltinOverrides: getApprovedBuiltinOverrides,
    setApprovedBuiltinOverrides: setApprovedBuiltinOverrides,
    getCategoryOverrides: getCategoryOverrides,
    setCategoryOverrides: setCategoryOverrides,
    updateCategoryOverride: updateCategoryOverride,
    computeOverrideFromBase: computeOverrideFromBase,
    approvePendingBuiltin: approvePendingBuiltin,
    approveAllPending: approveAllPending,
    getPendingBuiltinCount: getPendingBuiltinCount,
    validateHttpUrl: validateHttpUrl,
    exportBackup: exportBackup,
    exportBackupJson: exportBackupJson,
    importBackup: importBackup,
    downloadExport: downloadExport,
  };
})();
