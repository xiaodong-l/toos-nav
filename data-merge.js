(function () {
  "use strict";

  var S = window.AmazonNavStorage;
  var DATA = window.__AMAZON_NAV_TOOLS__;

  if (!S || !DATA) {
    console.error("data-merge 需要 AmazonNavStorage 与 __AMAZON_NAV_TOOLS__");
    return;
  }

  var baseById = Object.create(null);
  DATA.tools.forEach(function (t) {
    baseById[t.id] = t;
  });

  function getBaseData() {
    return DATA;
  }

  function getBaseTool(toolId) {
    return baseById[toolId] || null;
  }

  function isCustomToolId(id) {
    return typeof id === "string" && id.indexOf("custom-") === 0;
  }

  function customItemToTool(item) {
    var n = S.normalizeCustomItem(item);
    return {
      id: n.id,
      categoryId: n.categoryId,
      name: n.name,
      url: n.url ? n.url : null,
      description: n.description,
      subFunction: n.subFunction || undefined,
      type: n.type || "site",
      joinable: false,
      _isCustom: true,
    };
  }

  function getEffectiveBuiltinTool(toolId) {
    var base = baseById[toolId];
    if (!base) return null;
    var ov = S.getApprovedBuiltinOverrides()[toolId];
    if (!ov) return Object.assign({}, base);
    return Object.assign({}, base, ov);
  }

  function getFormSnapshotForBuiltin(toolId) {
    var pending = S.getPendingBuiltinEdits()[toolId];
    if (pending && pending.snapshot) {
      return Object.assign({}, pending.snapshot);
    }
    return Object.assign({}, getEffectiveBuiltinTool(toolId));
  }

  function getMergedToolById(toolId) {
    if (isCustomToolId(toolId)) {
      var list = S.getCustomItems();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === toolId) return customItemToTool(list[i]);
      }
      return null;
    }
    return getEffectiveBuiltinTool(toolId);
  }

  function getMergedToolsList() {
    var out = [];
    DATA.tools.forEach(function (t) {
      out.push(Object.assign({}, getEffectiveBuiltinTool(t.id)));
    });
    S.getCustomItems().forEach(function (c) {
      out.push(customItemToTool(c));
    });
    return out;
  }

  function getMergedCategories() {
    var cov = S.getCategoryOverrides();
    return (DATA.categories || []).map(function (c) {
      var o = Object.assign({}, c);
      var extra = cov[c.id];
      if (extra && Array.isArray(extra.intro) && extra.intro.length) {
        o.intro = extra.intro.slice();
      }
      return o;
    });
  }

  function toolsForCategoryMerged(catId) {
    return getMergedToolsList().filter(function (t) {
      return t.categoryId === catId;
    });
  }

  window.AmazonNavMerge = {
    getBaseData: getBaseData,
    getBaseTool: getBaseTool,
    isCustomToolId: isCustomToolId,
    customItemToTool: customItemToTool,
    getEffectiveBuiltinTool: getEffectiveBuiltinTool,
    getFormSnapshotForBuiltin: getFormSnapshotForBuiltin,
    getMergedToolById: getMergedToolById,
    getMergedToolsList: getMergedToolsList,
    getMergedCategories: getMergedCategories,
    toolsForCategoryMerged: toolsForCategoryMerged,
    baseById: baseById,
  };
})();
