(function () {
  "use strict";

  if (window.top !== window || document.documentElement.dataset.ao3mailLoaded) return;
  document.documentElement.dataset.ao3mailLoaded = "1";

  const state = {
    enabled: false, shell: null, originalNodes: [], rows: [], scrollY: 0,
    historyLoading: false, language: "zh", currentPage: 1, pageSize: 20, filter: ""
  };
  const text = (node) => node ? node.textContent.replace(/\s+/g, " ").trim() : "";

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
      messages: "封邮件", results: "个搜索结果", allHistory: "全部 History", noMatches: "没有匹配的邮件"
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
      messages: "messages", results: "search results", allHistory: "All History", noMatches: "No matching mail"
    }
  };

  function tr(key) {
    return (I18N[state.language] && I18N[state.language][key]) || I18N.zh[key] || key;
  }

  function localized(tag, className, key) {
    const element = make(tag, className, tr(key));
    element.dataset.i18n = key;
    return element;
  }

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
      date: text(date), href, sourceElement: blurb,
      historyDelete: historyDeleteData(blurb, baseHref),
      active: href.split("#")[0] === location.href.split("#")[0]
    };
  }

  function pageInfo() {
    const workTitle = document.querySelector("#workskin .preface h2.title, .work.meta h2.title, h2.title");
    const author = document.querySelector("#workskin .byline a[rel='author'], .work.meta .byline a[rel='author'], a[rel='author']");
    const documentTitle = document.title.replace(/\s*\|\s*Archive of Our Own.*$/i, "").trim();
    const title = text(workTitle) || documentTitle || "Archive of Our Own";
    const sender = text(author) || "Archive Team";
    const summary = text(document.querySelector("#workskin .summary blockquote, .work.meta .summary blockquote, .notice"));
    return { title, sender, summary };
  }

  function getRows() {
    const rows = [];
    const seen = new Set();
    const blurbs = document.querySelectorAll("li.work.blurb, li.bookmark.blurb, li.series.blurb");

    blurbs.forEach((blurb) => {
      const row = rowFromBlurb(blurb);
      if (!row || seen.has(row.href)) return;
      seen.add(row.href);
      rows.push(row);
    });

    if (!rows.length) {
      document.querySelectorAll("#chapters .chapter, #workskin .chapter").forEach((chapter, index) => {
        const heading = chapter.querySelector(".chapter.preface h3.title, h3.title");
        if (!chapter.id) chapter.id = `ao3mail-chapter-${index + 1}`;
        rows.push({
          title: text(heading) || `正文 ${index + 1}`,
          sender: pageInfo().sender,
          preview: text(chapter.querySelector(".userstuff p")) || "打开阅读窗格",
          date: index ? "" : "今天", href: `#${chapter.id}`,
          sourceElement: chapter, active: index === 0
        });
      });
    }

    if (!rows.length) {
      const info = pageInfo();
      rows.push({
        title: info.title, sender: info.sender, preview: info.summary || "AO3 系统邮件",
        date: "今天", href: location.href,
        sourceElement: document.querySelector("#workskin, #main") || document.body,
        active: true
      });
    }
    return rows;
  }

  function initials(name) {
    const clean = (name || "AO3").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    return ((parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)) || "AO").toUpperCase();
  }

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

  function makeButton(className, label, title) {
    const button = make("button", className, label);
    button.type = "button";
    if (title) button.title = title;
    return button;
  }

  function makeAction(className, key, title) {
    const button = makeButton(`ao3mail-action ${className}`, tr(key), title);
    button.dataset.i18n = key;
    return button;
  }

  function makeFolder(href, icon, key, count, selected = false) {
    const link = make("a", `folder${selected ? " selected" : ""}`);
    link.href = href;
    append(link, make("i", "", icon), localized("span", "folder-label", key));
    if (count !== undefined) link.appendChild(make("b", "", count));
    return link;
  }

  function makeMessageRow(item, index) {
    const link = make("a", `ao3mail-message${item.active ? " is-active" : ""}`);
    link.href = item.href;
    link.dataset.row = String(index);
    link.title = "单击选择，双击打开";
    const body = make("span", "ao3mail-row-main");
    append(body,
      make("strong", "", item.sender),
      make("span", "", item.title),
      make("small", "", item.preview)
    );
    append(link,
      make("span", "ao3mail-row-icon", index < 2 ? "●" : "○"),
      body,
      make("time", "", item.date)
    );
    return link;
  }

  function buildShell(info, rows) {
    const unread = Math.max(3, Math.min(999, rows.length * 3 + 5));
    const shell = make("div", "ao3mail-shell");
    shell.id = "ao3mail-shell";

    const topbar = make("header", "ao3mail-topbar");
    const appGrid = makeButton("ao3mail-app-grid", "⠿");
    appGrid.setAttribute("aria-label", "应用菜单");
    const search = make("form", "ao3mail-search");
    search.action = "https://archiveofourown.org/works/search";
    search.method = "get";
    const searchInput = make("input");
    searchInput.name = "work_search[query]";
    searchInput.placeholder = tr("search");
    searchInput.autocomplete = "off";
    searchInput.setAttribute("aria-label", "搜索所有邮件");
    const searchButton = makeButton("ao3mail-search-button", "⌕", "搜索所有邮件");
    searchButton.type = "submit";
    append(search, searchButton, searchInput);
    append(topbar,
      appGrid,
      make("span", "ao3mail-brand", "Outlook"),
      search,
      localized("span", "ao3mail-presence", "focus"),
      makeButton("ao3mail-language", state.language === "zh" ? "EN" : "中文", "中文 / English"),
      localized("button", "ao3mail-restore", "restore"),
      make("span", "ao3mail-avatar", initials(info.sender))
    );
    topbar.querySelector(".ao3mail-restore").type = "button";

    const ribbon = make("nav", "ao3mail-ribbon");
    const replyGroup = make("span", "ao3mail-reply-group");
    const replyMenu = make("select", "ao3mail-reply-menu");
    replyMenu.setAttribute("aria-label", "回复选项");
    [
      ["", "", "⌄"],
      ["reply", "replyWork", tr("replyWork")],
      ["comments", "viewComments", tr("viewComments")]
    ].forEach(([value, key, label]) => {
      const option = make("option", "", label);
      option.value = value;
      if (key) option.dataset.i18n = key;
      replyMenu.appendChild(option);
    });
    append(replyGroup, makeAction("ao3mail-reply", "reply", "前往作品评论框"), replyMenu);
    append(ribbon,
      localized("button", "ao3mail-new", "newMail"),
      makeAction("ao3mail-delete", "delete", "从 AO3 历史记录中删除"),
      makeAction("ao3mail-bookmark", "bookmark", "收藏当前 AO3 作品"),
      makeAction("ao3mail-mark", "mark", "Mark for Later / Mark as Read"),
      replyGroup,
      makeAction("ao3mail-forward", "forward", "复制当前作品链接"),
      makeAction("ao3mail-rss", "rss", "打开当前页面的 RSS/Atom 源")
    );
    ribbon.querySelector(".ao3mail-new").type = "button";

    const layout = make("main", "ao3mail-layout");
    const folders = make("aside", "ao3mail-folders");
    const account = make("div", "ao3mail-account");
    const accountText = make("div");
    append(accountText, localized("b", "", "mailbox"), make("small", "", "AO3 Workspace"));
    append(account, make("span", "", initials(info.sender)), accountText);
    append(folders,
      account,
      makeFolder("https://archiveofourown.org/", "⌂", "home"),
      makeFolder("https://archiveofourown.org/works", "▣", "inbox", unread, true),
      makeFolder("https://archiveofourown.org/bookmarks", "☆", "starred"),
      makeFolder("https://archiveofourown.org/works/search", "⌕", "searchFolders"),
      makeFolder("https://archiveofourown.org/users", "♙", "contacts"),
      localized("div", "folder-title", "folders"),
      makeFolder("https://archiveofourown.org/bookmarks", "⌁", "favorites"),
      makeFolder("https://archiveofourown.org/collections", "◇", "projects"),
      makeFolder("https://archiveofourown.org/tags", "▤", "tags"),
      makeFolder("https://archiveofourown.org/about", "ⓘ", "notices")
    );
    const folderFoot = make("div", "ao3mail-folder-foot");
    ["▧", "▦", "♙", "✓"].forEach((symbol) => folderFoot.appendChild(make("span", "", symbol)));
    folders.appendChild(folderFoot);

    const listPane = make("section", "ao3mail-listpane");
    const listHead = make("div", "ao3mail-listhead");
    const listTitle = make("div");
    append(listTitle, localized("b", "", "inbox"), make("small", "ao3mail-count", `${rows.length} ${tr("messages")}`));
    const listControls = make("div", "ao3mail-list-controls");
    const filterButton = localized("button", "ao3mail-filter", "filter");
    filterButton.type = "button";
    const previousButton = localized("button", "ao3mail-page-button ao3mail-previous", "previous");
    previousButton.type = "button";
    const pageStatus = make("span", "ao3mail-page-status", "1 / 1");
    const nextButton = localized("button", "ao3mail-page-button ao3mail-next", "next");
    nextButton.type = "button";
    const collapseButton = makeButton("ao3mail-collapse", "«", tr("minimize"));
    collapseButton.dataset.i18nTitle = "minimize";
    append(listControls, filterButton, previousButton, pageStatus, nextButton, collapseButton);
    append(listHead, listTitle, listControls);
    const messages = make("div", "ao3mail-messages");
    rows.forEach((item, index) => messages.appendChild(makeMessageRow(item, index)));
    const empty = localized("div", "ao3mail-empty", "noMatches");
    empty.hidden = true;
    messages.appendChild(empty);
    append(listPane, listHead, localized("div", "ao3mail-week", "lastWeek"), messages);

    const reading = make("section", "ao3mail-reading");
    const subject = make("div", "ao3mail-subject");
    const expandButton = localized("button", "ao3mail-expand", "expand");
    expandButton.type = "button";
    append(subject,
      expandButton,
      make("span", "ao3mail-pin", "♛"),
      make("h1", "", info.title),
      makeButton("ao3mail-more", "•••")
    );
    const sender = make("div", "ao3mail-sender");
    const senderText = make("div");
    const recipient = make("span");
    append(recipient,
      localized("span", "ao3mail-recipient-label", "recipient"),
      document.createTextNode("　"),
      make("span", "ao3mail-online", "●"),
      document.createTextNode(" "),
      localized("span", "ao3mail-current-user", "currentUser")
    );
    append(senderText,
      make("strong", "", `${info.sender} <notifications@archive.internal>`),
      recipient
    );
    append(sender,
      make("span", "ao3mail-sender-avatar", initials(info.sender)),
      senderText,
      localized("time", "", "today")
    );
    const original = make("div", "ao3mail-original");
    append(reading,
      subject,
      sender,
      localized("div", "ao3mail-notice", "externalNotice"),
      original
    );

    append(layout, folders, listPane, reading);
    append(shell, topbar, ribbon, layout);
    return shell;
  }

  function apply() {
    if (state.enabled || document.getElementById("ao3mail-shell")) return;
    state.scrollY = window.scrollY;
    state.currentPage = 1;
    state.filter = "";
    const info = pageInfo();
    const rows = getRows();
    state.rows = rows;
    state.originalNodes = Array.from(document.body.childNodes);

    state.shell = buildShell(info, rows);
    document.body.appendChild(state.shell);
    const original = state.shell.querySelector(".ao3mail-original");
    state.originalNodes.forEach((node) => original.appendChild(node));
    document.documentElement.classList.add("ao3mail-active");
    state.enabled = true;
    bindUI();
    window.scrollTo(0, 0);
  }

  function remove() {
    const shell = document.getElementById("ao3mail-shell");
    if (!shell) return;
    const original = shell.querySelector(".ao3mail-original");
    const fragment = document.createDocumentFragment();
    while (original.firstChild) fragment.appendChild(original.firstChild);
    shell.remove();
    document.body.appendChild(fragment);
    document.documentElement.classList.remove("ao3mail-active");
    state.enabled = false;
    state.shell = null;
    state.rows = [];
    state.currentPage = 1;
    state.filter = "";
    requestAnimationFrame(() => window.scrollTo(0, state.scrollY));
  }

  function setEnabled(value, remember = true) {
    value ? apply() : remove();
    if (remember && typeof browser !== "undefined" && browser.storage) {
      browser.storage.local.set({ ao3mailEnabled: Boolean(value) });
    }
  }

  function activeItem() {
    const selected = state.shell && state.shell.querySelector(".ao3mail-message.is-active");
    const index = selected ? Number(selected.dataset.row) : 0;
    return state.rows[Number.isInteger(index) ? index : 0] || state.rows[0] || null;
  }

  function setNotice(message, type = "info") {
    const notice = state.shell && state.shell.querySelector(".ao3mail-notice");
    if (!notice) return;
    notice.textContent = `${type === "success" ? "✓" : type === "error" ? "!" : "ⓘ"}　${message}`;
    notice.dataset.type = type;
  }

  function findAction(selector, item = activeItem()) {
    if (item && item.sourceElement) {
      const local = item.sourceElement.querySelector(selector);
      if (local) return local;
    }
    const original = state.shell && state.shell.querySelector(".ao3mail-original");
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
    if (item && item.historyDelete && item.sourceElement && !item.sourceElement.isConnected) {
      const request = item.historyDelete;
      const body = new URLSearchParams(request.fields);
      setNotice("正在从 AO3 历史记录中删除当前条目……");
      try {
        const response = await fetch(request.action, {
          method: request.method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        removeHistoryItem(item);
        setNotice("已从 AO3 历史记录中删除。", "success");
      } catch (_) {
        setNotice("删除失败，请打开该条目的 AO3 历史记录页面后重试。", "error");
      }
      return;
    }
    const button = findAction('input[type="submit"][value*="Delete from History"], button[value*="Delete from History"]');
    if (!button) {
      setNotice("当前邮件没有可用的“Delete from History”操作。请在 AO3 历史记录页面使用。", "error");
      return;
    }
    setNotice("正在从 AO3 历史记录中删除当前条目……");
    button.click();
  }

  function removeHistoryItem(item) {
    const index = state.rows.indexOf(item);
    if (index < 0) return;
    const row = state.shell.querySelector(`.ao3mail-message[data-row="${index}"]`);
    if (row) row.remove();
    state.rows.splice(index, 1);
    state.shell.querySelectorAll(".ao3mail-message").forEach((message, nextIndex) => {
      message.dataset.row = String(nextIndex);
    });
    const next = state.shell.querySelector(".ao3mail-message");
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
      setNotice("当前邮件不是可收藏的 AO3 作品。", "error");
      return;
    }
    location.assign(`${url}/bookmarks/new`);
  }

  function markWork() {
    const selector = 'input[type="submit"][value="Mark for Later"], input[type="submit"][value="Mark as Read"], button[value="Mark for Later"], button[value="Mark as Read"]';
    const button = findAction(selector);
    if (button) {
      setNotice(`正在执行“${button.value || button.textContent.trim()}”……`);
      button.click();
      return;
    }
    const url = workUrl();
    if (!url) {
      setNotice("当前邮件没有可用的标记操作。", "error");
      return;
    }
    sessionStorage.setItem("ao3mailPendingAction", "mark");
    location.assign(url);
  }

  function replyToWork() {
    const original = state.shell.querySelector(".ao3mail-original");
    const textarea = original.querySelector('textarea[name="comment[content]"], textarea[id*="comment_content"], #add_comment textarea');
    if (textarea) {
      textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => textarea.focus(), 350);
      setNotice("已定位到作品回复框。", "success");
      return;
    }
    const url = workUrl();
    if (url) {
      location.assign(`${url}#comments`);
    } else {
      setNotice("当前邮件没有可回复的作品页面。", "error");
    }
  }

  function viewComments() {
    const url = workUrl();
    if (url) location.assign(`${url}#comments`);
    else setNotice("当前邮件没有评论区。", "error");
  }

  async function copyWorkLink() {
    const item = activeItem();
    const url = workUrl(item) || (item && new URL(item.href, location.href).href) || location.href;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("作品链接已复制，可粘贴到邮件或聊天中。", "success");
    } catch (_) {
      const input = make("input");
      input.value = url;
      state.shell.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setNotice(copied ? "作品链接已复制。" : "无法自动复制，请从地址栏复制链接。", copied ? "success" : "error");
    }
  }

  function openRssFeed() {
    const feed = document.querySelector('link[type="application/atom+xml"][href], link[type="application/rss+xml"][href], .ao3mail-original a[href$=".atom"], .ao3mail-original a[href*="/feed"]');
    if (feed && feed.href) location.assign(feed.href);
    else setNotice("当前 AO3 页面没有提供 RSS/Atom 源。标签页或系列页通常会提供。", "error");
  }

  function filterMessages(query) {
    state.filter = query.trim().toLocaleLowerCase();
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
    state.shell.querySelectorAll(".ao3mail-message").forEach((row) => {
      row.hidden = !visible.has(Number(row.dataset.row));
    });
    const count = state.shell.querySelector(".ao3mail-count");
    const empty = state.shell.querySelector(".ao3mail-empty");
    const status = state.shell.querySelector(".ao3mail-page-status");
    const previous = state.shell.querySelector(".ao3mail-previous");
    const next = state.shell.querySelector(".ao3mail-next");
    if (count) count.textContent = state.filter
      ? `${matches.length} ${tr("results")}`
      : `${state.rows.length} ${tr("messages")}${isHistoryPage() && !state.historyLoading ? ` · ${tr("allHistory")}` : ""}`;
    if (empty) empty.hidden = matches.length !== 0;
    if (status) status.textContent = `${state.currentPage} / ${totalPages}`;
    if (previous) previous.disabled = state.currentPage <= 1;
    if (next) next.disabled = state.currentPage >= totalPages;
  }

  function changeMailboxPage(delta) {
    state.currentPage += delta;
    renderMailboxPage();
    const messages = state.shell.querySelector(".ao3mail-messages");
    if (messages) messages.scrollTop = 0;
  }

  function applyLanguage(remember = true) {
    if (!state.shell) return;
    state.shell.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = tr(element.dataset.i18n);
    });
    state.shell.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = tr(element.dataset.i18nTitle);
      element.setAttribute("aria-label", tr(element.dataset.i18nTitle));
    });
    const search = state.shell.querySelector(".ao3mail-search input");
    if (search) search.placeholder = tr("search");
    const language = state.shell.querySelector(".ao3mail-language");
    if (language) language.textContent = state.language === "zh" ? "EN" : "中文";
    renderMailboxPage();
    if (remember && typeof browser !== "undefined" && browser.storage) {
      browser.storage.local.set({ ao3mailLanguage: state.language });
    }
  }

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

  function appendHistoryRows(rows) {
    const messages = state.shell && state.shell.querySelector(".ao3mail-messages");
    const empty = state.shell && state.shell.querySelector(".ao3mail-empty");
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
    renderMailboxPage();
    return added;
  }

  async function loadAllHistory() {
    if (!isHistoryPage() || state.historyLoading) return;
    const totalPages = lastHistoryPage(document);
    if (totalPages <= 1) return;
    state.historyLoading = true;
    const count = state.shell.querySelector(".ao3mail-count");
    const currentPage = Number(new URL(location.href).searchParams.get("page")) || 1;
    const pages = [];
    for (let page = 1; page <= totalPages; page += 1) {
      if (page !== currentPage) pages.push(page);
    }
    let completed = 0;
    if (count) count.textContent = `正在读取全部 History：0/${pages.length} 页`;

    try {
      for (let start = 0; start < pages.length; start += 4) {
        if (!state.enabled || !state.shell) return;
        const batch = pages.slice(start, start + 4);
        const results = await Promise.all(batch.map(async (page) => {
          const url = new URL(location.href);
          url.searchParams.set("page", String(page));
          const response = await fetch(url.href, { credentials: "same-origin" });
          if (!response.ok) throw new Error(`History page ${page}: HTTP ${response.status}`);
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          return Array.from(doc.querySelectorAll("li.work.blurb, li.bookmark.blurb, li.series.blurb"))
            .map((blurb) => rowFromBlurb(blurb, url.href))
            .filter(Boolean);
        }));
        results.forEach(appendHistoryRows);
        completed += batch.length;
        if (count) count.textContent = `正在读取全部 History：${completed}/${pages.length} 页 · ${state.rows.length} 封邮件`;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      renderMailboxPage();
      setNotice(`已载入全部 History，共 ${state.rows.length} 条。`, "success");
    } catch (_) {
      if (count) count.textContent = `${state.rows.length} 封邮件 · History 载入未完成`;
      setNotice("部分 History 页面载入失败，可刷新页面后重试。", "error");
    } finally {
      state.historyLoading = false;
      renderMailboxPage();
    }
  }

  function runPendingAction() {
    if (sessionStorage.getItem("ao3mailPendingAction") !== "mark") return;
    sessionStorage.removeItem("ao3mailPendingAction");
    const button = findAction('input[type="submit"][value="Mark for Later"], input[type="submit"][value="Mark as Read"]');
    if (button) setTimeout(() => button.click(), 250);
    else setNotice("已打开作品页，但未找到可用的 Mark for Later 按钮。", "error");
  }

  function bindMessageRow(row) {
    if (row.dataset.bound === "1") return;
    row.dataset.bound = "1";
    row.addEventListener("click", (event) => {
      const href = row.getAttribute("href");
      event.preventDefault();
      state.shell.querySelectorAll(".ao3mail-message").forEach((el) => el.classList.remove("is-active"));
      row.classList.add("is-active");
      if (isHistoryPage()) {
        const item = state.rows[Number(row.dataset.row)];
        if (item && item.sourceElement && item.sourceElement.isConnected) {
          item.sourceElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setNotice("已选择 History 条目。双击邮件可打开作品。", "success");
        return;
      }
      if (href && href.startsWith("#")) {
        const target = state.shell.querySelector(href);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      setNotice("已选择邮件。双击可打开作品。", "success");
    });
    row.addEventListener("dblclick", (event) => {
      event.preventDefault();
      const href = row.getAttribute("href");
      if (href) location.assign(new URL(href, location.href).href);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const href = row.getAttribute("href");
      if (href) location.assign(new URL(href, location.href).href);
    });
  }

  function bindUI() {
    state.shell.querySelector(".ao3mail-restore").addEventListener("click", () => setEnabled(false));
    state.shell.querySelector(".ao3mail-language").addEventListener("click", () => {
      state.language = state.language === "zh" ? "en" : "zh";
      applyLanguage(true);
    });
    state.shell.querySelector(".ao3mail-filter").addEventListener("click", () => {
      const value = window.prompt(state.language === "zh" ? "筛选当前邮件列表" : "Filter the current mail list", state.filter);
      if (value !== null) filterMessages(value);
    });
    state.shell.querySelector(".ao3mail-previous").addEventListener("click", () => changeMailboxPage(-1));
    state.shell.querySelector(".ao3mail-next").addEventListener("click", () => changeMailboxPage(1));
    state.shell.querySelector(".ao3mail-collapse").addEventListener("click", () => {
      state.shell.classList.add("is-reading-focus");
    });
    state.shell.querySelector(".ao3mail-expand").addEventListener("click", () => {
      state.shell.classList.remove("is-reading-focus");
    });
    state.shell.querySelector(".ao3mail-new").addEventListener("click", () => location.assign("https://archiveofourown.org/works/new"));
    state.shell.querySelector(".ao3mail-delete").addEventListener("click", deleteFromHistory);
    state.shell.querySelector(".ao3mail-bookmark").addEventListener("click", bookmarkWork);
    state.shell.querySelector(".ao3mail-mark").addEventListener("click", markWork);
    state.shell.querySelector(".ao3mail-reply").addEventListener("click", replyToWork);
    state.shell.querySelector(".ao3mail-forward").addEventListener("click", copyWorkLink);
    state.shell.querySelector(".ao3mail-rss").addEventListener("click", openRssFeed);
    const replyMenu = state.shell.querySelector(".ao3mail-reply-menu");
    replyMenu.addEventListener("change", () => {
      if (replyMenu.value === "reply") replyToWork();
      if (replyMenu.value === "comments") viewComments();
      replyMenu.value = "";
    });
    const search = state.shell.querySelector(".ao3mail-search");
    const searchInput = search.querySelector("input");
    search.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!searchAllAo3Works(searchInput.value)) searchInput.focus();
    });
    state.shell.querySelectorAll(".ao3mail-message").forEach(bindMessageRow);
    applyLanguage(false);
    renderMailboxPage();
    runPendingAction();
    loadAllHistory();
  }

  if (typeof browser !== "undefined" && browser.runtime) {
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.type === "AO3MAIL_TOGGLE") setEnabled(!state.enabled);
    });
    browser.storage.local.get({ ao3mailEnabled: true, ao3mailLanguage: "zh" }).then(({ ao3mailEnabled, ao3mailLanguage }) => {
      state.language = ao3mailLanguage === "en" ? "en" : "zh";
      setEnabled(ao3mailEnabled, false);
    });
  } else {
    apply();
  }
})();
