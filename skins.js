(function () {
  "use strict";

  /* 皮肤注册表。每个皮肤提供：
       id / label / strings（覆盖 content.js 里的基础文案）
       build(api)          → 返回整个外壳元素
       row(api, item, i)   → 返回单条列表元素
     两个皮肤共用同一套内核，必须保留这些约定的类名作为挂载点：
       .owa-original .owa-messages .owa-reading .owa-count .owa-empty
       .owa-more-mail .owa-notice .owa-page-status .owa-previous .owa-next
     其余控件（.owa-restore / .owa-filter / .owa-new / .owa-delete …）都是可选的，
     内核按“存在才绑定”处理。 */

  const skins = {};
  window.__owaSkins = skins;

  /* ========================================================== 邮件皮肤 */

  skins.outlook = {
    id: "outlook",
    label: { zh: "邮件工作界面", en: "Mail workspace" },
    strings: {},
    build(api) {
      const { make, append, localized, makeButton, makeAction, initials, tr, state, info, rows, unreadCount, accountLink, accountCount, pageAction, accountSource, isCurrentFolder } = api;

    function makeFolder(href, icon, key, count, selected = false, child = false, source = "") {
      const link = make("a", `folder${selected ? " selected" : ""}${child ? " is-child" : ""}`);
      link.href = href;
      const label = localized("span", "folder-label", key);
      // 英文原名放在标签外面：applyLanguage 会重写 [data-i18n] 的整段文本，
      // 塞进去会被切换语言时抹掉。默认透明，悬停该行才淡入，行宽不跳动。
      append(link, make("i", "", icon), label,
        source ? make("em", "owa-folder-src", `· ${source}`) : null);
      if (count !== undefined) link.appendChild(make("b", "owa-folder-count", count));
      return link;
    }

    // AO3 面板上有对应链接才显示，取不到就整条略过，避免点出 404
    function accountFolder(key, icon, stringKey, child = false) {
      const href = accountLink(key);
      if (!href) return null;
      const folder = makeFolder(href, icon, stringKey, accountCount(key), false, child, accountSource(key));
      const badge = folder.querySelector(".owa-folder-count");
      if (badge) badge.dataset.fixed = "1";
      folder.dataset.href = href;
      return folder;
    }

    function buildShell(info, rows) {
      const shell = make("div", "owa-shell");
      shell.id = "owa-shell";

      const topbar = make("header", "owa-topbar");
      const appGrid = makeButton("owa-app-grid", "⠿");
      appGrid.setAttribute("aria-label", "应用菜单");
      const search = make("form", "owa-search");
      search.action = "https://archiveofourown.org/works/search";
      search.method = "get";
      const searchInput = make("input");
      searchInput.name = "work_search[query]";
      searchInput.placeholder = tr("search");
      searchInput.autocomplete = "off";
      searchInput.setAttribute("aria-label", tr("search"));
      const searchButton = makeButton("owa-search-button", "⌕", tr("search"));
      searchButton.type = "submit";
      append(search, searchButton, searchInput);
      append(topbar,
        appGrid,
        make("span", "owa-brand", "Outlook"),
        search,
        localized("span", "owa-presence", "focus"),
        makeButton("owa-language", state.language === "zh" ? "EN" : "中文", "中文 / English"),
        localized("button", "owa-restore", "restore"),
        make("span", "owa-avatar", initials(info.sender))
      );
      topbar.querySelector(".owa-restore").type = "button";

      const ribbon = make("nav", "owa-ribbon");
      const replyGroup = make("span", "owa-reply-group");
      const replyMenu = make("select", "owa-reply-menu");
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
      append(replyGroup, makeAction("owa-reply", "reply", "前往作品评论框"), replyMenu);
      append(ribbon,
        localized("button", "owa-new", "newMail"),
        makeAction("owa-edit-works", "editWorks", "批量编辑 AO3 作品"),
        makeAction("owa-delete", "delete", "从 AO3 历史记录中删除"),
        makeAction("owa-bookmark", "bookmark", "收藏当前 AO3 作品"),
        makeAction("owa-mark", "mark", "Mark for Later / Mark as Read"),
        replyGroup,
        makeAction("owa-forward", "forward", "复制当前作品链接"),
        makeAction("owa-rss", "rss", "打开当前页面的 RSS/Atom 源")
      );
      ribbon.querySelector(".owa-new").type = "button";

      const layout = make("main", "owa-layout");
      const folders = make("aside", "owa-folders");
      const account = make("div", "owa-account");
      const accountText = make("div");
      append(accountText, localized("b", "", "mailbox"), make("small", "", "Exchange Online"));
      append(account, make("span", "", initials(info.sender)), accountText);
      const accountRows = [
        accountFolder("dashboard", "▦", "deskFolder"),
        accountFolder("profile", "☰", "profileFolder"),
        accountFolder("preferences", "⚙", "prefsFolder"),
        accountFolder("skins", "◑", "skinsFolder"),
        accountFolder("invitations", "✚", "invitesFolder")
      ].filter(Boolean);

      append(folders, account);
      accountRows.forEach((row) => folders.appendChild(row));
      if (accountRows.length) folders.appendChild(make("div", "owa-folder-sep"));

      // 收件箱：默认展开，没有折叠箭头，点它就是去 AO3 Inbox
      const inboxHref = accountLink("inbox") || "https://archiveofourown.org/works";
      const inboxCount = accountCount("inbox");
      const inbox = makeFolder(inboxHref, "▣", "inbox",
        inboxCount === undefined ? unreadCount() : inboxCount, false, false, accountSource("inbox"));
      if (inboxCount !== undefined) {
        const badge = inbox.querySelector(".owa-folder-count");
        if (badge) badge.dataset.fixed = "1";
      }
      inbox.dataset.href = inboxHref;
      folders.appendChild(inbox);

      // 子文件夹按 AO3 面板的原顺序排，连分段也照搬
      const CHILD_GROUPS = [
        [["works", "➤", "sentItems"], ["drafts", "✎", "draftsFolder"], ["series", "❐", "seriesFolder"],
         ["bookmarks", "☆", "starred"], ["collections", "◇", "collectionsFolder"]],
        [["statistics", "▥", "statsFolder"], ["history", "▤", "archived"], ["subscriptions", "♪", "subsFolder"]],
        [["co-creator", "⚭", "coauthorFolder"], ["requests", "✉", "requestsFolder"],
         ["sign-ups", "✍", "signupsFolder"], ["assignments", "✓", "assignmentsFolder"],
         ["claims", "✋", "claimsFolder"], ["related-works", "⚯", "relatedFolder"],
         ["gifts", "❖", "giftsFolder"]]
      ];
      CHILD_GROUPS.forEach((group) => {
        const built = group
          .map(([key, icon, stringKey]) => accountFolder(key, icon, stringKey, true))
          .filter(Boolean);
        if (!built.length) return;
        if (folders.querySelector(".folder.is-child")) folders.appendChild(make("div", "owa-folder-subsep"));
        built.forEach((row) => folders.appendChild(row));
      });

      append(folders,
        localized("div", "folder-title", "folders"),
        makeFolder("https://archiveofourown.org/works/search", "⌕", "searchFolders"),
        makeFolder("https://archiveofourown.org/users", "♙", "contacts"),
        makeFolder("https://archiveofourown.org/bookmarks", "⌁", "favorites"),
        makeFolder("https://archiveofourown.org/collections", "◇", "projects"),
        makeFolder("https://archiveofourown.org/tags", "▤", "tags"),
        makeFolder("https://archiveofourown.org/about", "ⓘ", "notices")
      );

      // 高亮当前所在的文件夹；都不匹配时回落到收件箱
      const marked = [...folders.querySelectorAll(".folder[data-href]")]
        .find((row) => isCurrentFolder(row.dataset.href));
      (marked || inbox).classList.add("selected");

      const folderFoot = make("div", "owa-folder-foot");
      ["▧", "▦", "♙", "✓"].forEach((symbol) => folderFoot.appendChild(make("span", "", symbol)));
      folders.appendChild(folderFoot);

      const listPane = make("section", "owa-listpane");
      const listHead = make("div", "owa-listhead");
      const listTitle = make("div");
      append(listTitle, localized("b", "", "inbox"), make("small", "owa-count", `${rows.length} ${tr("messages")}`));
      const listControls = make("div", "owa-list-controls");
      const filterButton = localized("button", "owa-filter", "filter");
      filterButton.type = "button";
      const previousButton = localized("button", "owa-page-button owa-previous", "previous");
      previousButton.type = "button";
      const pageStatus = make("span", "owa-page-status", "1 / 1");
      const nextButton = localized("button", "owa-page-button owa-next", "next");
      nextButton.type = "button";
      const collapseButton = makeButton("owa-collapse", "«", tr("minimize"));
      collapseButton.dataset.i18nTitle = "minimize";
      append(listControls, filterButton, previousButton, pageStatus, nextButton, collapseButton);
      append(listHead, listTitle, listControls);
      const messages = make("div", "owa-messages");
      rows.forEach((item, index) => messages.appendChild(api.makeRow(item, index)));
      const empty = localized("div", "owa-empty", "noMatches");
      empty.hidden = true;
      const more = localized("button", "owa-more-mail", "loadMore");
      more.type = "button";
      more.hidden = true;
      append(messages, empty, more);
      append(listPane, listHead, localized("div", "owa-week", "lastWeek"), messages);

      const reading = make("section", "owa-reading");
      const subject = make("div", "owa-subject");
      const expandButton = localized("button", "owa-expand", "expand");
      expandButton.type = "button";
      const moreButton = makeButton("owa-more", "•••");
      const menu = make("div", "owa-menu");
      const lockItem = makeButton("owa-menu-item owa-menu-lock", tr("autoLockLabel"));
      lockItem.dataset.i18n = "autoLockLabel";
      lockItem.dataset.checked = state.autoLock ? "1" : "0";
      const clearItem = makeButton("owa-menu-item owa-menu-clear", tr("clearMarks"));
      clearItem.dataset.i18n = "clearMarks";
      append(menu, lockItem);
      // 注册了两套以上皮肤时才显示「切换界面风格」
      if (Object.keys(skins).length > 1) {
        const skinItem = makeButton("owa-menu-item owa-menu-skin", tr("skinSwitch"));
        skinItem.dataset.i18n = "skinSwitch";
        append(menu, skinItem);
      }
      append(menu, clearItem);
      const moreWrap = make("span", "owa-more-wrap");
      append(moreWrap, moreButton, menu);
      append(subject,
        expandButton,
        make("span", "owa-pin", "♛"),
        make("h1", "", info.title),
        moreWrap
      );
      const sender = make("div", "owa-sender");
      const senderText = make("div");
      const recipient = make("span");
      append(recipient,
        localized("span", "owa-recipient-label", "recipient"),
        document.createTextNode("　"),
        make("span", "owa-online", "●"),
        document.createTextNode(" "),
        localized("span", "owa-current-user", "currentUser")
      );
      append(senderText,
        make("strong", "", `${info.sender} <notifications@archive.internal>`),
        recipient
      );
      const subscribeNode = pageAction(/^(Unsubscribe|Subscribe)$/i);
      const subscribeButton = subscribeNode
        ? makeButton("owa-subscribe", tr(/^Unsubscribe$/i.test((subscribeNode.value || subscribeNode.textContent || "").trim()) ? "unsubscribe" : "subscribe"))
        : null;
      append(sender,
        make("span", "owa-sender-avatar", initials(info.sender)),
        senderText,
        subscribeButton,
        localized("time", "", "today")
      );
      const original = make("div", "owa-original");
      append(reading,
        subject,
        sender,
        localized("div", "owa-notice", "externalNotice"),
        original
      );

      append(layout, folders, listPane, reading);
      append(shell, topbar, ribbon, layout);
      return shell;
    }

      return buildShell(info, rows);
    },
    row(api, item, index) {
      const { make, append, isRead, state } = api;

    function makeMessageRow(item, index) {
      const unread = !isRead(item);
      const link = make("a", `owa-message${item.active ? " is-active" : ""}${unread ? " is-unread" : ""}`);
      link.href = item.href;
      link.dataset.row = String(index);
      link.title = state.language === "zh" ? "单击选择，双击打开" : "Click to select, double-click to open";
      const body = make("span", "owa-row-main");
      append(body,
        make("strong", "", item.sender),
        make("span", "", item.title),
        make("small", "", item.preview)
      );
      append(link,
        make("span", "owa-row-icon", unread ? "●" : "○"),
        body,
        make("time", "", item.date)
      );
      return link;
    }

      return makeMessageRow(item, index);
    }
  };

})();
