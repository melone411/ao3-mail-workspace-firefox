(function () {
  "use strict";

  if (window.top !== window || document.documentElement.dataset.owaReady) return;
  document.documentElement.dataset.owaReady = "1";

  /* ---------------------------------------------------------------- 常量 */

  const ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAADcElEQVRYhc2XW2yTZRjHf+/Xb7Sro3YnRjALITNs1q1Tx9DoBa4KxrFMQwgsnJy6iEFmXAJe954FZ0BnFlGjg7gLEsW4jJAdLowc0klhDSxxC4dlYYyOHtZ1o+v6eqFfQyndydr6v3y+53t+/7zP877f9wo0NXbqTRj2Cyl3AaXAEyRXPiR/IMQXvuO201pQAOR+2P1UWOVXoDzJ0AQSHT4x8w7Hqh8oNHbqUwsHkDvNEcMJAGFq7PlYSPl56uAP2RCiRhFS7k4HHEDAQQWwpMsAUr6kAFlpMwBmJY1wANRHA28/v4qa8nxURSQVFI5IfnHe42fneGIDtmdyGPOHuD0xQ9PmtYgkeZASPjt3i7uTIapKsukd9DzewCqTnh8v3uHCsJdLN3y07bNgyoxbpCXJPx3mg++v0eVyA7Bz4+qY5zEzUFWczVZrPgBdLje2ZgeDY1PLhg+OTWFrdkThW6352EpyEhvQqwrtDWXYa4vQKYKh8SCvNTv46XJs3xajLpebLUf7GRoPIgR8snktPzSUoldj5z5uF2jJHfutmI0qUw/mePdbF/Yzw8xF5IJgKaHl3C12tQ3gnw6z0qByssGKvbYI5TFDlXAbvm7JpfdwJZY1WdGibx13cm8ylBDuCc6yvdWJ/cwwESlZX2Ck+9AGqq15Cd+Z9xxYl5dJz6EN1P0zOL/96eHVIw4u356My3WNBqg64qD7+n0Atr1QQN+nlawvMM6HmN8AgCFD4au9FlrqSsjQCUY9M7zZ0s+pi3eiOaf777LlaD833dPoFIG9togT9c9iXKFbqHz8QZRI9a+sYV1eJu9952IiMMuB9uu4RgMAfNk7AkBuVgbf1JeyqTh7sWUXbwBgU3E2fYcr2fP1AFdGJqNggPLClbQ3lFGYY1hKyYVb8KgKcwycbaqIzgVA3cbVnG2qWDIclrgCmrS5qC77+9CqfS5/OWWWb0DTvwFrSvvn+P9lwBOc/c+BE4FYRoyB1t6RuIRkyh2YpbVvJCYmnjzY7QNMWsBsVHn5aTMrdMntTmguwu9DXrzB8MNhvwryPIg3tIg3GKbzqjup8MSS1xQplGMposXjhTgpAMwf9bRLkeoLinT68u6/qAB4lZn3QXSkEq6GRQ32HaGYXxRzY882iTyApAIwJ5kaAAak4JQ/d6IN+44QwF/QbSb3lo70UAAAAABJRU5ErkJggg==";

  const KEYS = {
    enabled: "owaEnabled",
    language: "owaLanguage",
    autoLock: "owaAutoLock",
    marks: "owaMarks",
    cache: "owaPageCache",
    skin: "owaSkin",
    account: "owaAccount"
  };

  const CACHE_TTL = 6 * 60 * 60 * 1000;   // 分页缓存有效期：6 小时
  const CACHE_MAX = 300;                  // 最多缓存多少个分页
  const MARK_MAX = 3000;                  // 最多记录多少条阅读记录
  const FIRST_BATCH = 2;                  // 进入 History 时先抓几页
  const NEXT_BATCH = 3;                   // 之后每次续抓几页
  const CONCURRENCY = 2;                  // 并发请求数
  const store = (typeof browser !== "undefined" && browser.storage) ? browser.storage.local : null;

  /* ---------------------------------------------------------------- 状态 */

  const state = {
    enabled: false, shell: null, rows: [], scrollY: 0,
    contentNode: null, placeholder: null, legacyNodes: null,
    language: "zh", skin: "outlook", currentPage: 1, pageSize: 20, filter: "",
    historyLoading: false, historyQueue: [], historyTotal: 1,
    veil: null, veiled: false, menuGuard: false, autoLock: false, navigating: false, navTimer: null, account: null, chromeApplied: false, chromeFromVeil: false,
    originalTitle: "", iconLinks: [], ownIcon: null,
    marks: { read: {}, pos: {} }, cache: {},
    markTimer: null, cacheTimer: null, lastEscape: 0
  };

  const text = (node) => node ? node.textContent.replace(/\s+/g, " ").trim() : "";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function scrollTo(element, block = "start") {
    if (!element || typeof element.scrollIntoView !== "function") return;
    try {
      element.scrollIntoView({ behavior: "smooth", block });
    } catch (_) {
      element.scrollIntoView();
    }
  }

  /* ------------------------------------------------------------- 多语言 */

  const I18N = {
    zh: {
      focus: "工作专注", restore: "恢复 AO3", search: "搜索所有邮件", newMail: "＋ 新邮件",
      delete: "⌫ 删除", bookmark: "☆ Bookmark", mark: "⚑ 标记", reply: "↶ 回复",
      forward: "↱ 转发", rss: "⌁ RSS 源", replyWork: "回复作品", viewComments: "查看评论",
      mailbox: "工作邮箱", home: "主页", inbox: "收件箱", starred: "已加星标",
      searchFolders: "搜索文件夹", contacts: "通讯录", folders: "文件夹", favorites: "收藏夹",
      projects: "项目归档", tags: "分类标签", notices: "企业公告", filter: "筛选⌄",
      lastWeek: "⌄　上周", previous: "‹ 上一页", next: "下一页 ›", minimize: "最小化文件夹",
      expand: "展开文件夹", recipient: "收件人", currentUser: "当前用户", today: "今天",
      externalNotice: "ⓘ　此邮件来自企业外部，但已通过安全归档扫描。可在阅读窗格中正常使用原页面链接。",
      messages: "封邮件", results: "个搜索结果", allHistory: "全部 History", noMatches: "没有匹配的邮件",
      veilTitle: "正在与 Exchange 服务器同步",
      veilHint: "正在下载新邮件，请稍候……（点击任意位置继续）",
      veilAccount: "workmail · Microsoft Exchange",
      loadMore: "载入更多邮件", loading: "正在载入……", loadedAll: "已载入全部邮件",
      autoLockOn: "自动锁定已开启：窗口失去焦点时会显示同步界面。连按两下 Esc 可随时手动呼出。",
      autoLockOff: "自动锁定已关闭，只有连按两下 Esc 或 Alt+Shift+X 才会呼出同步界面。",
      autoLockLabel: "自动锁定屏幕（失焦时）", clearMarks: "清除阅读记录与缓存",
      cleared: "阅读记录与分页缓存已清除。",
      resumed: "已恢复上次阅读位置。",
      historyProgress: "正在读取 History",
      historyPartial: "部分分页载入失败，可点击“载入更多邮件”重试。",
      pages: "页",
      filterPrompt: "筛选当前列表",
      skinSwitch: "切换界面风格",
      deskFolder: "工作台", profileFolder: "我的名片", prefsFolder: "邮箱设置",
      skinsFolder: "主题外观", invitesFolder: "邀请他人",
      sentItems: "已发送邮件", draftsFolder: "草稿", seriesFolder: "会话组",
      collectionsFolder: "共享文件夹", statsFolder: "使用情况报表", archived: "已归档",
      subsFolder: "关注的会话", coauthorFolder: "共同编辑", requestsFolder: "待处理请求",
      signupsFolder: "活动报名", assignmentsFolder: "分派任务", claimsFolder: "认领任务",
      relatedFolder: "关联邮件", giftsFolder: "共享给我",
      editWorks: "✎ 修改", unsubscribe: "取消订阅", subscribe: "订阅",
      noAction: "当前页面没有这个操作。"
    },
    en: {
      focus: "Focus", restore: "Restore AO3", search: "Search all mail", newMail: "+ New work",
      delete: "⌫ Delete", bookmark: "☆ Bookmark", mark: "⚑ Mark", reply: "↶ Reply",
      forward: "↱ Copy link", rss: "⌁ RSS Feed", replyWork: "Reply to work", viewComments: "View comments",
      mailbox: "Work Mailbox", home: "Home", inbox: "Inbox", starred: "Starred",
      searchFolders: "Search folders", contacts: "Contacts", folders: "Folders", favorites: "Favorites",
      projects: "Project archive", tags: "Tags", notices: "Notices", filter: "Filter⌄",
      lastWeek: "⌄　Last week", previous: "‹ Previous", next: "Next ›", minimize: "Minimize folders",
      expand: "Show folders", recipient: "To", currentUser: "Current user", today: "Today",
      externalNotice: "ⓘ　This external message passed the archive scan. Original AO3 links remain available in the reading pane.",
      messages: "messages", results: "search results", allHistory: "All History", noMatches: "No matching mail",
      veilTitle: "Synchronising with Exchange server",
      veilHint: "Downloading new messages, please wait… (click anywhere to continue)",
      veilAccount: "workmail · Microsoft Exchange",
      loadMore: "Load more messages", loading: "Loading…", loadedAll: "All messages loaded",
      autoLockOn: "Auto-lock on: the sync screen appears when the window loses focus.",
      autoLockOff: "Auto-lock off — press Esc twice or Alt+Shift+X to show the sync screen.",
      autoLockLabel: "Auto-lock on blur", clearMarks: "Clear reading history and cache",
      cleared: "Reading history and page cache cleared.",
      resumed: "Reading position restored.",
      historyProgress: "Loading History",
      historyPartial: "Some pages failed to load. Use “Load more messages” to retry.",
      pages: "pages",
      filterPrompt: "Filter the current list",
      skinSwitch: "Switch interface style",
      deskFolder: "Dashboard", profileFolder: "My card", prefsFolder: "Mailbox settings",
      skinsFolder: "Appearance", invitesFolder: "Invite others",
      sentItems: "Sent items", draftsFolder: "Drafts", seriesFolder: "Threads",
      collectionsFolder: "Shared folders", statsFolder: "Usage report", archived: "Archive",
      subsFolder: "Followed", coauthorFolder: "Co-authoring", requestsFolder: "Pending",
      signupsFolder: "Event sign-ups", assignmentsFolder: "Assigned tasks", claimsFolder: "Claimed tasks",
      relatedFolder: "Linked mail", giftsFolder: "Shared with me",
      editWorks: "✎ Edit", unsubscribe: "Unsubscribe", subscribe: "Subscribe",
      noAction: "That action is not available on this page."
    }
  };

  function tr(key) {
    const extra = (skin() && skin().strings) || {};
    const localExtra = extra[state.language] || {};
    if (localExtra[key] !== undefined) return localExtra[key];
    const zhExtra = extra.zh || {};
    return (I18N[state.language] && I18N[state.language][key]) || I18N.zh[key] || zhExtra[key] || key;
  }

  /* --------------------------------------------------- 基础 DOM 工具函数 */

  function make(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = String(content);
    return element;
  }

  function append(parent, ...children) {
    children.filter(Boolean).forEach((child) => parent.appendChild(child));
    return parent;
  }

  function localized(tag, className, key) {
    const element = make(tag, className, tr(key));
    element.dataset.i18n = key;
    return element;
  }

  function makeButton(className, label, title) {
    const button = make("button", className, label);
    button.type = "button";
    if (title) button.title = title;
    return button;
  }

  function makeAction(className, key, title) {
    const button = makeButton(`owa-action ${className}`, tr(key), title);
    button.dataset.i18n = key;
    return button;
  }

  function initials(name) {
    const clean = (name || "AO3").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    return ((parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)) || "WM").toUpperCase();
  }

  /* ------------------------------------------ ① 标签页标题 / favicon 伪装 */

  function applyChrome() {
    if (state.chromeApplied) return;
    state.originalTitle = document.title;
    state.iconLinks = Array.from(
      document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    );
    state.iconLinks.forEach((link) => link.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.href = ICON;
    (document.head || document.documentElement).appendChild(icon);
    state.ownIcon = icon;
    state.chromeApplied = true;
    updateTitle();
  }

  function restoreChrome() {
    if (!state.chromeApplied) return;
    if (state.ownIcon) {
      if (state.iconLinks.length) {
        state.ownIcon.remove();
        const head = document.head || document.documentElement;
        state.iconLinks.forEach((link) => head.appendChild(link));
      } else {
        // 页面本来没有显式 icon 标签，改指回站点默认图标即可还原。
        state.ownIcon.href = `${location.origin}/favicon.ico`;
      }
    }
    state.ownIcon = null;
    state.iconLinks = [];
    if (state.originalTitle) document.title = state.originalTitle;
    state.chromeApplied = false;
  }

  function unreadCount() {
    if (!state.rows.length) return 0;
    return state.rows.filter((item) => !isRead(item)).length;
  }

  function updateTitle() {
    if (!state.chromeApplied) return;
    const count = state.enabled ? unreadCount() : 0;
    const suffix = count > 0 ? ` (${count})` : "";
    document.title = `${tr("inbox")}${suffix} - ${tr("mailbox")} - Outlook`;
  }

  /* ------------------------------------------------- ④ 老板键 / 同步遮罩 */

  function buildVeil() {
    const veil = make("div", "owa-veil");
    veil.id = "owa-veil";
    const box = make("div", "owa-veil-box");
    const logo = make("div", "owa-veil-logo", "✉");
    const bar = make("div", "owa-veil-bar");
    bar.appendChild(make("i"));
    append(box,
      logo,
      localized("div", "owa-veil-title", "veilTitle"),
      localized("div", "owa-veil-account", "veilAccount"),
      bar,
      localized("div", "owa-veil-hint", "veilHint")
    );
    veil.appendChild(box);
    veil.addEventListener("click", () => setVeil(false));
    return veil;
  }

  function ensureVeil() {
    if (state.veil && state.veil.isConnected) return state.veil;
    state.veil = buildVeil();
    document.body.appendChild(state.veil);
    return state.veil;
  }

  function setVeil(on) {
    if (on) {
      if (!state.chromeApplied) {
        applyChrome();
        state.chromeFromVeil = true;
      }
      const veil = ensureVeil();
      veil.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = tr(el.dataset.i18n); });
      veil.classList.add("is-visible");
      document.documentElement.classList.add("owa-veiled");
      state.veiled = true;
    } else {
      if (state.veil) state.veil.classList.remove("is-visible");
      document.documentElement.classList.remove("owa-veiled");
      state.veiled = false;
      if (state.chromeFromVeil && !state.enabled) {
        restoreChrome();
        state.chromeFromVeil = false;
      }
    }
  }

  function setAutoLock(value) {
    state.autoLock = Boolean(value);
    if (store) store.set({ [KEYS.autoLock]: state.autoLock });
    setNotice(tr(state.autoLock ? "autoLockOn" : "autoLockOff"), "success");
    const item = state.shell && state.shell.querySelector(".owa-menu-lock");
    if (item) item.dataset.checked = state.autoLock ? "1" : "0";
  }

  function bindGlobalGuards() {
    // 页面正在跳转时不要弹遮罩，否则每次翻页、点开作品都要手动关一次。
    const markNavigating = () => {
      state.navigating = true;
      clearTimeout(state.navTimer);
      state.navTimer = setTimeout(() => { state.navigating = false; }, 1500);
    };
    window.addEventListener("beforeunload", markNavigating);
    window.addEventListener("pagehide", markNavigating);
    document.addEventListener("submit", markNavigating, true);
    document.addEventListener("click", (event) => {
      const link = event.target && typeof event.target.closest === "function"
        ? event.target.closest("a[href]")
        : null;
      if (link && !link.getAttribute("href").startsWith("#")) markNavigating();
    }, true);

    // 自动锁定默认关闭，只有在 ••• 菜单里手动打开后才会因失焦弹出。
    window.addEventListener("blur", () => {
      if (state.autoLock && !state.navigating && !state.veiled) setVeil(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.autoLock && !state.navigating && !state.veiled) setVeil(true);
    });
    document.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        const now = Date.now();
        if (state.veiled) {
          setVeil(false);
          state.lastEscape = 0;
          return;
        }
        if (now - state.lastEscape < 600) {
          setVeil(true);
          state.lastEscape = 0;
        } else {
          state.lastEscape = now;
        }
      }
    }, true);
  }

  /* ------------------------------------------------------------ 皮肤 */

  const SKINS = (typeof window !== "undefined" && window.__owaSkins) || {};
  const DEFAULT_SKIN = "outlook";

  function skin() {
    return SKINS[state.skin] || SKINS[DEFAULT_SKIN] || Object.values(SKINS)[0];
  }

  /* ------------------------------------------- AO3 账户信息（侧栏文件夹用） */

  const ACCOUNT_FALLBACK = {
    dashboard: "/users/{u}",
    profile: "/users/{u}/profile",
    preferences: "/users/{u}/preferences",
    skins: "/skins",
    invitations: "/users/{u}/invitations",
    works: "/users/{u}/works",
    series: "/users/{u}/series",
    bookmarks: "/users/{u}/bookmarks",
    collections: "/users/{u}/collections",
    inbox: "/users/{u}/inbox",
    statistics: "/users/{u}/stats",
    history: "/users/{u}/readings",
    subscriptions: "/users/{u}/subscriptions",
    gifts: "/users/{u}/gifts"
  };

  // AO3 面板上的英文原名，悬停时显示在中文名后面
  const ACCOUNT_SOURCE = {
    dashboard: "Dashboard", profile: "Profile", preferences: "Preferences",
    skins: "Skins", invitations: "Invitations",
    works: "Works", drafts: "Drafts", series: "Series",
    bookmarks: "Bookmarks", collections: "Collections",
    inbox: "Inbox", statistics: "Statistics", history: "History",
    subscriptions: "Subscriptions", "co-creator": "Co-Creator",
    requests: "Requests", "sign-ups": "Sign-ups", assignments: "Assignments",
    claims: "Claims", "related-works": "Related Works", gifts: "Gifts"
  };

  // 当前页面是否就是这个文件夹（用于侧栏高亮）
  function isCurrentFolder(href) {
    try {
      const target = new URL(href, location.href);
      return target.pathname.replace(/\/$/, "") === location.pathname.replace(/\/$/, "");
    } catch (_) {
      return false;
    }
  }

  // AO3 侧栏条目形如 "Works (32)"，键统一成小写英文名
  function parseAccount() {
    const greeting = document.querySelector('#greeting a[href*="/users/"], #header .user a[href*="/users/"]');
    let user = null;
    if (greeting) {
      const match = (greeting.getAttribute("href") || "").match(/\/users\/([^/?#]+)/);
      if (match) user = decodeURIComponent(match[1]);
    }
    const links = {};
    const counts = {};
    document.querySelectorAll("#dashboard a[href]").forEach((link) => {
      const raw = text(link);
      const withCount = raw.match(/^(.*?)\s*\((\d+)\)$/);
      const key = (withCount ? withCount[1] : raw).trim().toLowerCase().replace(/\s+/g, "-");
      if (!key) return;
      try {
        links[key] = new URL(link.getAttribute("href"), location.href).href;
      } catch (_) { return; }
      if (withCount) counts[key] = Number(withCount[2]);
    });
    if (!user && !Object.keys(links).length) return null;
    return { user, links, counts, t: Date.now() };
  }

  // 当前页有面板就刷新缓存，没有就沿用上次读到的
  function refreshAccount() {
    const fresh = parseAccount();
    if (!fresh) return;
    const previous = state.account || {};
    state.account = {
      user: fresh.user || previous.user || null,
      links: Object.assign({}, previous.links, fresh.links),
      counts: Object.assign({}, previous.counts, fresh.counts),
      t: fresh.t
    };
    if (store) store.set({ [KEYS.account]: state.account }).catch(() => {});
  }

  function accountLink(key) {
    const account = state.account;
    if (!account) return null;
    if (account.links && account.links[key]) return account.links[key];
    const fallback = ACCOUNT_FALLBACK[key];
    if (!fallback || !account.user) return null;
    return `${location.origin}${fallback.replace("{u}", encodeURIComponent(account.user))}`;
  }

  function accountCount(key) {
    const account = state.account;
    return account && account.counts && key in account.counts ? account.counts[key] : undefined;
  }

  // 面板上的按钮（Edit Works / Subscribe / Unsubscribe）只在部分页面存在，
  // 找不到就让皮肤把对应控件藏起来，避免点出 404。
  function pageAction(matcher) {
    const original = state.shell && state.shell.querySelector(".owa-original");
    const scope = original || document;
    const nodes = scope.querySelectorAll('a[href], input[type="submit"], button');
    for (const node of nodes) {
      const label = (node.value || node.textContent || "").replace(/\s+/g, " ").trim();
      if (label && matcher.test(label)) return node;
    }
    return null;
  }

  function skinApi(info, rows) {
    return {
      make, append, localized, makeButton, makeAction, initials, tr,
      state, info, rows, isRead, unreadCount, readKey,
      account: state.account, accountLink, accountCount, pageAction,
      accountSource: (key) => ACCOUNT_SOURCE[key] || "", isCurrentFolder,
      makeRow: (item, index) => makeMessageRow(item, index)
    };
  }

  function buildShell(info, rows) {
    const active = skin();
    const shell = active.build(skinApi(info, rows));
    shell.id = "owa-shell";
    shell.classList.add("owa-shell");
    shell.dataset.skin = active.id;
    return shell;
  }

  function makeMessageRow(item, index) {
    const row = skin().row(skinApi(null, state.rows), item, index);
    row.classList.add("owa-message");
    row.classList.toggle("is-unread", !isRead(item));
    row.dataset.row = String(index);
    if (!row.getAttribute("href")) row.setAttribute("href", item.href);
    return row;
  }

  function switchSkin(id) {
    if (!SKINS[id] || id === state.skin) return;
    const wasEnabled = state.enabled;
    if (wasEnabled) remove();
    state.skin = id;
    if (store) store.set({ [KEYS.skin]: id }).catch(() => {});
    if (wasEnabled) apply();
  }

  function nextSkinId() {
    const ids = Object.keys(SKINS);
    if (ids.length < 2) return state.skin;
    return ids[(ids.indexOf(state.skin) + 1) % ids.length];
  }

  /* --------------------------------------------------- ⑦ 阅读进度与已读状态 */

  function readKey(href) {
    try {
      const url = new URL(href, location.href);
      const match = url.pathname.match(/\/(works|series)\/\d+/);
      return match ? match[0] : url.pathname;
    } catch (_) {
      return String(href || "");
    }
  }

  function posKey() {
    return `${location.pathname}${location.search}`;
  }

  function isRead(item) {
    const key = item && (item.key || readKey(item.href));
    return Boolean(key && state.marks.read[key]);
  }

  function markRead(key) {
    if (!key) return;
    state.marks.read[key] = Date.now();
    scheduleMarkSave();
  }

  function savePosition(top) {
    state.marks.pos[posKey()] = { s: Math.max(0, Math.round(top)), t: Date.now() };
    scheduleMarkSave();
  }

  function trimMarks() {
    ["read", "pos"].forEach((bucket) => {
      const entries = Object.entries(state.marks[bucket]);
      if (entries.length <= MARK_MAX) return;
      entries.sort((a, b) => {
        const at = bucket === "read" ? a[1] : (a[1] && a[1].t) || 0;
        const bt = bucket === "read" ? b[1] : (b[1] && b[1].t) || 0;
        return bt - at;
      });
      state.marks[bucket] = Object.fromEntries(entries.slice(0, MARK_MAX));
    });
  }

  function scheduleMarkSave() {
    if (!store) return;
    clearTimeout(state.markTimer);
    state.markTimer = setTimeout(() => {
      trimMarks();
      store.set({ [KEYS.marks]: state.marks }).catch(() => {});
    }, 1200);
  }

  function flushMarks() {
    if (!store) return;
    clearTimeout(state.markTimer);
    trimMarks();
    store.set({ [KEYS.marks]: state.marks }).catch(() => {});
  }

  function restorePosition() {
    const record = state.marks.pos[posKey()];
    const reading = state.shell && state.shell.querySelector(".owa-reading");
    if (!reading || !record || !record.s) return;
    let tries = 0;
    const seek = () => {
      reading.scrollTop = record.s;
      tries += 1;
      if (Math.abs(reading.scrollTop - record.s) > 8 && tries < 12) setTimeout(seek, 120);
      else if (tries === 1 || reading.scrollTop > 200) setNotice(tr("resumed"), "success");
    };
    setTimeout(seek, 160);
  }

  function bindProgressTracking() {
    const reading = state.shell.querySelector(".owa-reading");
    if (!reading) return;
    let timer = null;
    reading.addEventListener("scroll", () => {
      clearTimeout(timer);
      timer = setTimeout(() => savePosition(reading.scrollTop), 400);
    }, { passive: true });
  }

  /* ------------------------------------------------------- 页面内容解析 */

  function historyDeleteData(blurb, baseHref = location.href) {
    const button = blurb.querySelector('input[type="submit"][value*="Delete from History"], button[value*="Delete from History"]');
    const form = button && button.closest("form");
    if (!button || !form) return null;
    const fields = [];
    new FormData(form).forEach((value, name) => {
      if (typeof value === "string") fields.push([name, value]);
    });
    if (button.name && !fields.some(([name]) => name === button.name)) fields.push([button.name, button.value || "Delete from History"]);
    return {
      action: new URL(form.getAttribute("action") || baseHref, baseHref).href,
      method: (form.getAttribute("method") || "post").toUpperCase(),
      fields
    };
  }

  function rowFromBlurb(blurb, baseHref = location.href) {
    const link = blurb.querySelector("h4.heading a[href*='/works/'], h4.heading a[href*='/series/']");
    if (!link) return null;
    const href = new URL(link.getAttribute("href"), baseHref).href;
    const author = blurb.querySelector("a[rel='author']");
    const fandom = blurb.querySelector("h5.fandoms a, .fandoms a");
    const date = blurb.querySelector("p.datetime");
    const summary = blurb.querySelector("blockquote.userstuff.summary, .summary blockquote");
    return {
      title: text(link), sender: text(author) || text(fandom) || "AO3 通知",
      preview: text(summary) || text(fandom) || "存档邮件",
      date: text(date), href, key: readKey(href), sourceElement: blurb,
      historyDelete: historyDeleteData(blurb, baseHref),
      active: href.split("#")[0] === location.href.split("#")[0]
    };
  }

  function pageInfo() {
    const workTitle = document.querySelector("#workskin .preface h2.title, .work.meta h2.title, h2.title");
    const author = document.querySelector("#workskin .byline a[rel='author'], .work.meta .byline a[rel='author'], a[rel='author']");
    const documentTitle = (state.originalTitle || document.title).replace(/\s*\|\s*Archive of Our Own.*$/i, "").trim();
    const title = text(workTitle) || documentTitle || "Archive of Our Own";
    const sender = text(author) || "Archive Team";
    const summary = text(document.querySelector("#workskin .summary blockquote, .work.meta .summary blockquote, .notice"));
    return { title, sender, summary };
  }

  function getRows() {
    const rows = [];
    const seen = new Set();
    document.querySelectorAll("li.work.blurb, li.bookmark.blurb, li.series.blurb").forEach((blurb) => {
      const row = rowFromBlurb(blurb);
      if (!row || seen.has(row.href)) return;
      seen.add(row.href);
      rows.push(row);
    });

    if (!rows.length) {
      const info = pageInfo();
      document.querySelectorAll("#chapters .chapter:not(.preface), #workskin .chapter:not(.preface)").forEach((chapter, index) => {
        const heading = chapter.querySelector(".chapter.preface h3.title, h3.title");
        if (!chapter.id) chapter.id = `owa-chapter-${index + 1}`;
        rows.push({
          title: text(heading) || `${state.language === "zh" ? "正文" : "Part"} ${index + 1}`,
          sender: info.sender,
          preview: text(chapter.querySelector(".userstuff p")) || tr("today"),
          date: index ? "" : tr("today"), href: `#${chapter.id}`,
          key: `${readKey(location.href)}#${index + 1}`,
          sourceElement: chapter, active: index === 0
        });
      });
    }

    if (!rows.length) {
      const info = pageInfo();
      rows.push({
        title: info.title, sender: info.sender, preview: info.summary || "AO3",
        date: tr("today"), href: location.href, key: readKey(location.href),
        sourceElement: null, active: true
      });
    }
    return rows;
  }

  /* --------------------------------------------------------- 界面构建 */



  function refreshRowStates() {
    if (!state.shell) return;
    state.shell.querySelectorAll(".owa-message").forEach((row) => {
      const item = state.rows[Number(row.dataset.row)];
      if (!item) return;
      const unread = !isRead(item);
      row.classList.toggle("is-unread", unread);
      const icon = row.querySelector(".owa-row-icon");
      if (icon) icon.textContent = unread ? "●" : "○";
    });
  }


  /* ------------------------------- ⑩ 只搬运主内容节点，其余原地隐藏 */

  function pickContentRoot() {
    return document.getElementById("main")
      || document.getElementById("inner")
      || document.querySelector("#workskin")
      || null;
  }

  function moveContentInto(original) {
    const root = pickContentRoot();
    if (root && root.parentNode) {
      state.placeholder = document.createComment("owa-content");
      root.parentNode.insertBefore(state.placeholder, root);
      original.appendChild(root);
      state.contentNode = root;
      return;
    }
    // 极少数没有 #main 的页面：退回旧的整体搬运方式。
    state.legacyNodes = Array.from(document.body.childNodes).filter((node) => node !== state.shell && node !== state.veil);
    state.legacyNodes.forEach((node) => original.appendChild(node));
  }

  function restoreContent() {
    if (state.contentNode && state.placeholder && state.placeholder.parentNode) {
      state.placeholder.parentNode.insertBefore(state.contentNode, state.placeholder);
      state.placeholder.remove();
    } else if (state.legacyNodes) {
      const fragment = document.createDocumentFragment();
      state.legacyNodes.forEach((node) => fragment.appendChild(node));
      document.body.appendChild(fragment);
    }
    state.contentNode = null;
    state.placeholder = null;
    state.legacyNodes = null;
  }

  function apply() {
    if (state.enabled || document.getElementById("owa-shell")) return;
    state.scrollY = window.scrollY;
    state.currentPage = 1;
    state.filter = "";
    refreshAccount();
    const info = pageInfo();
    const rows = getRows();
    state.rows = rows;

    state.shell = buildShell(info, rows);
    document.body.appendChild(state.shell);
    moveContentInto(state.shell.querySelector(".owa-original"));
    document.documentElement.classList.add("owa-active");
    state.enabled = true;
    applyChrome();
    bindUI();
    markCurrentPageRead();
    restorePosition();
  }

  function remove() {
    const shell = document.getElementById("owa-shell");
    if (!shell) return;
    restoreContent();
    shell.remove();
    document.documentElement.classList.remove("owa-active");
    state.enabled = false;
    state.shell = null;
    state.rows = [];
    state.currentPage = 1;
    state.filter = "";
    state.historyQueue = [];
    restoreChrome();
    flushMarks();
    requestAnimationFrame(() => window.scrollTo(0, state.scrollY));
  }

  function setEnabled(value, remember = true) {
    value ? apply() : remove();
    if (remember && store) store.set({ [KEYS.enabled]: Boolean(value) }).catch(() => {});
  }

  function markCurrentPageRead() {
    if (!/\/(works|series)\/\d+/.test(location.pathname)) return;
    markRead(readKey(location.href));
    refreshRowStates();
    updateTitle();
  }

  /* --------------------------------------------------------- 工具栏动作 */

  function activeItem() {
    const selected = state.shell && state.shell.querySelector(".owa-message.is-active");
    const index = selected ? Number(selected.dataset.row) : 0;
    return state.rows[Number.isInteger(index) ? index : 0] || state.rows[0] || null;
  }

  function setNotice(message, type = "info") {
    const notice = state.shell && state.shell.querySelector(".owa-notice");
    if (!notice) return;
    notice.textContent = `${type === "success" ? "✓" : type === "error" ? "!" : "ⓘ"}　${message}`;
    notice.dataset.type = type;
  }

  function findAction(selector, item = activeItem()) {
    if (item && item.sourceElement) {
      const local = item.sourceElement.querySelector(selector);
      if (local) return local;
    }
    const original = state.shell && state.shell.querySelector(".owa-original");
    return original ? original.querySelector(selector) : null;
  }

  function workUrl(item = activeItem()) {
    if (!item) return null;
    try {
      const url = new URL(item.href, location.href);
      const match = url.pathname.match(/\/works\/\d+/);
      return match ? `${url.origin}${match[0]}` : null;
    } catch (_) {
      return null;
    }
  }

  async function deleteFromHistory() {
    const item = activeItem();
    const detached = item && item.historyDelete && (!item.sourceElement || !item.sourceElement.isConnected);
    if (detached) {
      const request = item.historyDelete;
      setNotice(state.language === "zh" ? "正在从 AO3 历史记录中删除当前条目……" : "Deleting from AO3 history…");
      try {
        const response = await fetch(request.action, {
          method: request.method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: new URLSearchParams(request.fields)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        removeHistoryItem(item);
        setNotice(state.language === "zh" ? "已从 AO3 历史记录中删除。" : "Removed from AO3 history.", "success");
      } catch (_) {
        setNotice(state.language === "zh"
          ? "删除失败，请刷新 History 页面后重试。"
          : "Delete failed. Reload the History page and try again.", "error");
      }
      return;
    }
    const button = findAction('input[type="submit"][value*="Delete from History"], button[value*="Delete from History"]');
    if (!button) {
      setNotice(state.language === "zh"
        ? "当前邮件没有可用的“Delete from History”操作。"
        : "No “Delete from History” action for this message.", "error");
      return;
    }
    button.click();
  }

  function removeHistoryItem(item) {
    const index = state.rows.indexOf(item);
    if (index < 0) return;
    const row = state.shell.querySelector(`.owa-message[data-row="${index}"]`);
    if (row) row.remove();
    state.rows.splice(index, 1);
    state.shell.querySelectorAll(".owa-message").forEach((message, nextIndex) => {
      message.dataset.row = String(nextIndex);
    });
    const next = state.shell.querySelector(".owa-message");
    if (next) next.classList.add("is-active");
    renderMailboxPage();
  }

  function bookmarkWork() {
    const item = activeItem();
    const local = item && item.sourceElement
      ? item.sourceElement.querySelector('a[href*="/bookmarks/new"], a[href*="/bookmarks/"]')
      : null;
    const currentPage = findAction('.work.navigation.actions a[href*="/bookmarks/new"], .work.navigation.actions a[href*="/bookmarks/"]', item);
    const target = local || currentPage;
    if (target && target.href) {
      location.assign(target.href);
      return;
    }
    const url = workUrl(item);
    if (!url) {
      setNotice(state.language === "zh" ? "当前邮件不是可收藏的 AO3 作品。" : "This message is not a bookmarkable work.", "error");
      return;
    }
    location.assign(`${url}/bookmarks/new`);
  }

  function markWork() {
    const selector = 'input[type="submit"][value="Mark for Later"], input[type="submit"][value="Mark as Read"], button[value="Mark for Later"], button[value="Mark as Read"]';
    const button = findAction(selector);
    if (button) {
      button.click();
      return;
    }
    const url = workUrl();
    if (!url) {
      setNotice(state.language === "zh" ? "当前邮件没有可用的标记操作。" : "No mark action available.", "error");
      return;
    }
    sessionStorage.setItem("owaPendingAction", "mark");
    location.assign(url);
  }

  function replyToWork() {
    const original = state.shell.querySelector(".owa-original");
    const textarea = original.querySelector('textarea[name="comment[content]"], textarea[id*="comment_content"], #add_comment textarea');
    if (textarea) {
      scrollTo(textarea, "center");
      setTimeout(() => textarea.focus(), 350);
      return;
    }
    const url = workUrl();
    if (url) location.assign(`${url}#comments`);
    else setNotice(state.language === "zh" ? "当前邮件没有可回复的作品页面。" : "No comment box available.", "error");
  }

  function viewComments() {
    const url = workUrl();
    if (url) location.assign(`${url}#comments`);
    else setNotice(state.language === "zh" ? "当前邮件没有评论区。" : "No comments for this message.", "error");
  }

  async function copyWorkLink() {
    const item = activeItem();
    const url = workUrl(item) || (item && new URL(item.href, location.href).href) || location.href;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(state.language === "zh" ? "作品链接已复制。" : "Link copied.", "success");
    } catch (_) {
      const input = make("input");
      input.value = url;
      state.shell.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setNotice(copied
        ? (state.language === "zh" ? "作品链接已复制。" : "Link copied.")
        : (state.language === "zh" ? "无法自动复制，请从地址栏复制。" : "Copy failed, use the address bar."),
        copied ? "success" : "error");
    }
  }

  function openRssFeed() {
    const feed = document.querySelector('link[type="application/atom+xml"][href], link[type="application/rss+xml"][href], .owa-original a[href$=".atom"], .owa-original a[href*="/feed"]');
    if (feed && feed.href) location.assign(feed.href);
    else setNotice(state.language === "zh" ? "当前页面没有提供 RSS/Atom 源。" : "No RSS/Atom feed on this page.", "error");
  }

  /* ----------------------------------------------------- 列表筛选与分页 */

  function filterMessages(query) {
    state.filter = String(query == null ? "" : query).trim().toLocaleLowerCase();
    state.currentPage = 1;
    renderMailboxPage();
  }

  function searchAllAo3Works(query) {
    const value = String(query || "").trim();
    if (!value) return false;
    const target = new URL("https://archiveofourown.org/works/search");
    target.searchParams.set("work_search[query]", value);
    location.assign(target.href);
    return true;
  }

  function matchingMessageIndexes() {
    const matches = [];
    state.rows.forEach((item, index) => {
      const haystack = `${item.sender} ${item.title} ${item.preview}`.toLocaleLowerCase();
      if (!state.filter || haystack.includes(state.filter)) matches.push(index);
    });
    return matches;
  }

  function renderMailboxPage() {
    if (!state.shell) return;
    const matches = matchingMessageIndexes();
    const totalPages = Math.max(1, Math.ceil(matches.length / state.pageSize));
    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
    const start = (state.currentPage - 1) * state.pageSize;
    const visible = new Set(matches.slice(start, start + state.pageSize));
    state.shell.querySelectorAll(".owa-message").forEach((row) => {
      row.hidden = !visible.has(Number(row.dataset.row));
    });
    const count = state.shell.querySelector(".owa-count");
    const empty = state.shell.querySelector(".owa-empty");
    const status = state.shell.querySelector(".owa-page-status");
    const previous = state.shell.querySelector(".owa-previous");
    const next = state.shell.querySelector(".owa-next");
    const more = state.shell.querySelector(".owa-more-mail");
    const folderCount = state.shell.querySelector(".owa-folder-count:not([data-fixed])");
    if (count && !state.historyLoading) {
      count.textContent = state.filter
        ? `${matches.length} ${tr("results")}`
        : `${state.rows.length} ${tr("messages")}${isHistoryPage() && !state.historyQueue.length ? ` · ${tr("allHistory")}` : ""}`;
    }
    if (empty) empty.hidden = matches.length !== 0;
    if (status) status.textContent = `${state.currentPage} / ${totalPages}`;
    if (previous) previous.disabled = state.currentPage <= 1;
    if (next) next.disabled = state.currentPage >= totalPages;
    if (more) {
      more.hidden = !state.historyQueue.length;
      more.disabled = state.historyLoading;
      more.textContent = state.historyLoading ? tr("loading") : tr("loadMore");
    }
    if (folderCount) folderCount.textContent = String(unreadCount());
    updateTitle();
  }

  function changeMailboxPage(delta) {
    state.currentPage += delta;
    renderMailboxPage();
    const messages = state.shell.querySelector(".owa-messages");
    if (messages) messages.scrollTop = 0;
    const matches = matchingMessageIndexes();
    const totalPages = Math.max(1, Math.ceil(matches.length / state.pageSize));
    if (delta > 0 && state.currentPage >= totalPages) loadHistoryBatch(NEXT_BATCH);
  }

  function applyLanguage(remember = true) {
    if (!state.shell) return;
    // 英文界面下文件夹名本来就是英文，再挂一遍原名是重复的
    state.shell.dataset.lang = state.language;
    state.shell.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = tr(element.dataset.i18n);
    });
    state.shell.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = tr(element.dataset.i18nTitle);
      element.setAttribute("aria-label", tr(element.dataset.i18nTitle));
    });
    if (state.veil) {
      state.veil.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = tr(el.dataset.i18n); });
    }
    const search = state.shell.querySelector(".owa-search input");
    if (search) search.placeholder = tr("search");
    const language = state.shell.querySelector(".owa-language");
    if (language) language.textContent = state.language === "zh" ? "EN" : "中文";
    renderMailboxPage();
    if (remember && store) store.set({ [KEYS.language]: state.language }).catch(() => {});
  }

  /* ------------------------------------- ⑨ History 增量抓取 / 缓存 / 退避 */

  function isHistoryPage() {
    return /^\/users\/[^/]+\/readings\/?$/.test(location.pathname);
  }

  function lastHistoryPage(doc) {
    let last = Number(new URL(location.href).searchParams.get("page")) || 1;
    doc.querySelectorAll("ol.pagination a[href], ul.pagination a[href], .pagination a[href]").forEach((link) => {
      try {
        const page = Number(new URL(link.getAttribute("href"), location.href).searchParams.get("page"));
        if (Number.isFinite(page)) last = Math.max(last, page);
      } catch (_) {}
    });
    return last;
  }

  function cacheKey(page) {
    return `${location.pathname}#${page}`;
  }

  function packRow(row) {
    return { t: row.title, s: row.sender, p: row.preview, d: row.date, h: row.href, x: row.historyDelete || null };
  }

  function unpackRow(packed) {
    return {
      title: packed.t, sender: packed.s, preview: packed.p, date: packed.d, href: packed.h,
      key: readKey(packed.h), historyDelete: packed.x, sourceElement: null, active: false
    };
  }

  function trimCache() {
    const entries = Object.entries(state.cache);
    const fresh = entries.filter(([, value]) => value && Date.now() - value.t < CACHE_TTL);
    fresh.sort((a, b) => b[1].t - a[1].t);
    state.cache = Object.fromEntries(fresh.slice(0, CACHE_MAX));
  }

  function scheduleCacheSave() {
    if (!store) return;
    clearTimeout(state.cacheTimer);
    state.cacheTimer = setTimeout(() => {
      trimCache();
      store.set({ [KEYS.cache]: state.cache }).catch(() => {});
    }, 1500);
  }

  async function fetchText(url, tries = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (response.status === 429 || response.status === 503) {
          await sleep(2000 * Math.pow(2, attempt));
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) {
        lastError = error;
        if (attempt < tries - 1) await sleep(600 * Math.pow(2, attempt));
      }
    }
    throw lastError || new Error("request failed");
  }

  async function loadHistoryPage(page) {
    const key = cacheKey(page);
    const cached = state.cache[key];
    if (cached && Date.now() - cached.t < CACHE_TTL && Array.isArray(cached.r)) {
      return cached.r.map(unpackRow);
    }
    const url = new URL(location.href);
    url.searchParams.set("page", String(page));
    const html = await fetchText(url.href);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = Array.from(doc.querySelectorAll("li.work.blurb, li.bookmark.blurb, li.series.blurb"))
      .map((blurb) => rowFromBlurb(blurb, url.href))
      .filter(Boolean);
    state.cache[key] = { t: Date.now(), r: rows.map(packRow) };
    scheduleCacheSave();
    return rows.map((row) => Object.assign(row, { sourceElement: null }));
  }

  function appendRows(rows) {
    const messages = state.shell && state.shell.querySelector(".owa-messages");
    const empty = state.shell && state.shell.querySelector(".owa-empty");
    if (!messages) return 0;
    const known = new Set(state.rows.map((item) => item.href));
    let added = 0;
    rows.forEach((item) => {
      if (!item || known.has(item.href)) return;
      item.active = false;
      const index = state.rows.length;
      state.rows.push(item);
      known.add(item.href);
      const message = makeMessageRow(item, index);
      bindMessageRow(message);
      messages.insertBefore(message, empty || null);
      added += 1;
    });
    return added;
  }

  function prepareHistoryQueue() {
    if (!isHistoryPage()) return;
    state.historyTotal = lastHistoryPage(document);
    const current = Number(new URL(location.href).searchParams.get("page")) || 1;
    state.historyQueue = [];
    for (let page = 1; page <= state.historyTotal; page += 1) {
      if (page !== current) state.historyQueue.push(page);
    }
  }

  async function loadHistoryBatch(size = NEXT_BATCH) {
    if (state.historyLoading || !state.historyQueue.length || !state.enabled) return;
    state.historyLoading = true;
    renderMailboxPage();
    const count = state.shell.querySelector(".owa-count");
    const batch = state.historyQueue.splice(0, size);
    const failed = [];
    try {
      for (let start = 0; start < batch.length; start += CONCURRENCY) {
        if (!state.enabled || !state.shell) return;
        const slice = batch.slice(start, start + CONCURRENCY);
        if (count) {
          const done = state.historyTotal - state.historyQueue.length - (batch.length - start);
          count.textContent = `${tr("historyProgress")} ${Math.max(1, done)}/${state.historyTotal} ${tr("pages")} · ${state.rows.length} ${tr("messages")}`;
        }
        const results = await Promise.all(slice.map(async (page) => {
          try {
            return await loadHistoryPage(page);
          } catch (_) {
            failed.push(page);
            return [];
          }
        }));
        results.forEach(appendRows);
        await sleep(250);
      }
    } finally {
      if (failed.length) state.historyQueue = failed.concat(state.historyQueue);
      state.historyLoading = false;
      renderMailboxPage();
      if (failed.length) setNotice(tr("historyPartial"), "error");
      else if (!state.historyQueue.length && isHistoryPage()) setNotice(tr("loadedAll"), "success");
    }
  }

  function runPendingAction() {
    if (sessionStorage.getItem("owaPendingAction") !== "mark") return;
    sessionStorage.removeItem("owaPendingAction");
    const button = findAction('input[type="submit"][value="Mark for Later"], input[type="submit"][value="Mark as Read"]');
    if (button) setTimeout(() => button.click(), 250);
  }

  /* ------------------------------------------------------------ 事件绑定 */

  function bindMessageRow(row) {
    if (row.dataset.bound === "1") return;
    row.dataset.bound = "1";
    row.addEventListener("click", (event) => {
      const href = row.getAttribute("href");
      event.preventDefault();
      state.shell.querySelectorAll(".owa-message").forEach((el) => el.classList.remove("is-active"));
      row.classList.add("is-active");
      const item = state.rows[Number(row.dataset.row)];
      if (isHistoryPage()) {
        if (item && item.sourceElement && item.sourceElement.isConnected) {
          scrollTo(item.sourceElement);
        }
        return;
      }
      if (href && href.startsWith("#")) {
        if (item) {
          markRead(item.key);
          refreshRowStates();
          renderMailboxPage();
        }
        scrollTo(state.shell.querySelector(href));
      }
    });
    row.addEventListener("dblclick", (event) => {
      event.preventDefault();
      const href = row.getAttribute("href");
      const item = state.rows[Number(row.dataset.row)];
      if (item) markRead(item.key);
      if (href) {
        flushMarks();
        location.assign(new URL(href, location.href).href);
      }
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const href = row.getAttribute("href");
      if (href) location.assign(new URL(href, location.href).href);
    });
  }

  /* AO3 原生分页兜底：即使外框、浮动侧栏或其他元素挡在链接上方，
     也能把点击正确送到对应的分页链接。 */
  function bindPagination(reading) {
    if (!reading) return;
    const PAGER = ".pagination a[href], li.next > a[href], li.previous > a[href]";
    reading.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;

      const direct = target.closest(PAGER);
      if (direct) {
        event.preventDefault();
        flushMarks();
        location.assign(direct.href);
        return;
      }

      // 点在按钮框的空白处、或被上层元素挡住时，按坐标找回下面的分页链接。
      if (target.closest("a[href], button, input, select, textarea")) return;
      if (typeof document.elementsFromPoint !== "function") return;
      const stack = document.elementsFromPoint(event.clientX, event.clientY) || [];
      for (const element of stack) {
        const link = element && typeof element.closest === "function" ? element.closest(PAGER) : null;
        if (link && reading.contains(link)) {
          event.preventDefault();
          flushMarks();
          location.assign(link.href);
          return;
        }
      }
    }, true);
  }

  // 功能区/发件人行里那些只在部分 AO3 页面存在的动作
  function bindPageAction(selector, matcher) {
    const button = state.shell && state.shell.querySelector(selector);
    if (!button) return;
    const node = pageAction(matcher);
    if (!node) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.addEventListener("click", () => {
      const target = pageAction(matcher);
      if (!target) {
        setNotice(tr("noAction"), "error");
        return;
      }
      const href = target.getAttribute && target.getAttribute("href");
      if (href) {
        flushMarks();
        location.assign(new URL(href, location.href).href);
      } else {
        target.click();
      }
    });
  }

  function bindUI() {
    const shell = state.shell;

    // 皮肤之间的控件不完全一致，所有绑定都按“存在才绑”处理。
    const on = (selector, handler, event = "click") => {
      const node = shell.querySelector(selector);
      if (node) node.addEventListener(event, handler);
      return node;
    };

    on(".owa-restore", () => setEnabled(false));
    on(".owa-language", () => {
      state.language = state.language === "zh" ? "en" : "zh";
      applyLanguage(true);
    });
    on(".owa-skin-switch", () => switchSkin(nextSkinId()));
    on(".owa-filter", () => {
      const value = window.prompt(tr("filterPrompt"), state.filter);
      if (value !== null && value !== undefined) filterMessages(value);
    });
    on(".owa-previous", () => changeMailboxPage(-1));
    on(".owa-next", () => changeMailboxPage(1));
    on(".owa-collapse", () => shell.classList.add("is-reading-focus"));
    on(".owa-expand", () => shell.classList.remove("is-reading-focus"));
    on(".owa-new", () => location.assign("https://archiveofourown.org/works/new"));
    on(".owa-delete", deleteFromHistory);
    on(".owa-bookmark", bookmarkWork);
    on(".owa-mark", markWork);
    on(".owa-reply", replyToWork);
    on(".owa-comments", viewComments);
    on(".owa-forward", copyWorkLink);
    on(".owa-rss", openRssFeed);
    bindPageAction(".owa-edit-works", /^Edit Works$/i);
    bindPageAction(".owa-subscribe", /^(Unsubscribe|Subscribe)$/i);
    on(".owa-more-mail", () => loadHistoryBatch(NEXT_BATCH));

    const menu = shell.querySelector(".owa-menu");
    const moreButton = shell.querySelector(".owa-more");
    if (menu && moreButton) {
      moreButton.addEventListener("click", (event) => {
        event.stopPropagation();
        menu.classList.toggle("is-open");
      });
      if (!state.menuGuard) {
        state.menuGuard = true;
        document.addEventListener("click", () => {
          const open = document.querySelector(".owa-menu.is-open");
          if (open) open.classList.remove("is-open");
        });
      }
    }
    const closeMenu = () => { if (menu) menu.classList.remove("is-open"); };
    on(".owa-menu-lock", () => { setAutoLock(!state.autoLock); closeMenu(); });
    on(".owa-menu-skin", () => { closeMenu(); switchSkin(nextSkinId()); });
    on(".owa-menu-clear", () => {
      state.marks = { read: {}, pos: {} };
      state.cache = {};
      if (store) store.set({ [KEYS.marks]: state.marks, [KEYS.cache]: state.cache }).catch(() => {});
      refreshRowStates();
      renderMailboxPage();
      setNotice(tr("cleared"), "success");
      closeMenu();
    });

    const replyMenu = shell.querySelector(".owa-reply-menu");
    if (replyMenu) {
      replyMenu.addEventListener("change", () => {
        if (replyMenu.value === "reply") replyToWork();
        if (replyMenu.value === "comments") viewComments();
        replyMenu.value = "";
      });
    }

    const search = shell.querySelector(".owa-search");
    if (search) {
      const searchInput = search.querySelector("input");
      search.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!searchAllAo3Works(searchInput ? searchInput.value : "")) {
          if (searchInput) searchInput.focus();
        }
      });
    }

    bindPagination(shell.querySelector(".owa-reading"));

    const messages = shell.querySelector(".owa-messages");
    if (messages) {
      messages.addEventListener("scroll", () => {
        if (messages.scrollTop + messages.clientHeight >= messages.scrollHeight - 60) {
          loadHistoryBatch(NEXT_BATCH);
        }
      }, { passive: true });
    }

    shell.querySelectorAll(".owa-message").forEach(bindMessageRow);
    bindProgressTracking();
    applyLanguage(false);
    prepareHistoryQueue();
    renderMailboxPage();
    runPendingAction();
    if (isHistoryPage()) loadHistoryBatch(FIRST_BATCH);
  }

  /* ------------------------------------------------------------- 启动 */

  window.addEventListener("pagehide", flushMarks);
  bindGlobalGuards();

  if (typeof browser !== "undefined" && browser.runtime && store) {
    browser.runtime.onMessage.addListener((message) => {
      if (!message) return;
      if (message.type === "OWA_TOGGLE") setEnabled(!state.enabled);
      if (message.type === "OWA_VEIL") setVeil(!state.veiled);
      if (message.type === "OWA_SKIN") switchSkin(nextSkinId());
    });
    store.get({
      [KEYS.enabled]: true,
      [KEYS.language]: "zh",
      [KEYS.autoLock]: false,
      [KEYS.marks]: { read: {}, pos: {} },
      [KEYS.cache]: {},
      [KEYS.skin]: DEFAULT_SKIN,
      [KEYS.account]: null
    }).then((data) => {
      state.language = data[KEYS.language] === "en" ? "en" : "zh";
      state.skin = SKINS[data[KEYS.skin]] ? data[KEYS.skin] : DEFAULT_SKIN;
      state.autoLock = data[KEYS.autoLock] === true;
      const marks = data[KEYS.marks] || {};
      state.marks = { read: marks.read || {}, pos: marks.pos || {} };
      state.cache = data[KEYS.cache] || {};
      state.account = data[KEYS.account] || null;
      trimCache();
      refreshAccount();
      setEnabled(data[KEYS.enabled], false);
    }).catch(() => apply());
  } else {
    refreshAccount();
    apply();
  }
})();
