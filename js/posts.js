/* ============================================================
   HelpHive — posts.js
   ============================================================
   PURPOSE: This is the biggest file. It does three jobs:
   1. Loads our "database" (the 4 JSON files in /data) using fetch()
   2. Provides helper functions to read/search that data, PLUS
      anything created in the browser (new posts, votes, saves,
      comments) which we store in localStorage so it "feels real"
      even though there's no actual server.
   3. Looks at WHICH page we're on (by checking which HTML
      elements exist) and renders the right content into it.

   ⚠️ IMPORTANT BEGINNER NOTE ABOUT fetch() AND LOCAL FILES:
   Browsers block fetch() from reading local files directly when
   you just double-click an HTML file (a "file://" address) —
   this is a security rule, not a bug in this code. To actually
   see posts load, open this folder with a simple local server.
   Two easy free options:
     - VS Code: install the "Live Server" extension, right-click
       index.html, choose "Open with Live Server"
     - Or run this in a terminal inside the helphive folder:
       python -m http.server
       then visit http://localhost:8000 in your browser
   ============================================================ */

const HH_POSTS = {

  /* ── IN-MEMORY CACHE ────────────────────────────────────────
     Once we fetch the JSON files, we keep them here so we don't
     have to re-fetch every time we need the data.
  ──────────────────────────────────────────────────────────── */
  cache: {
    posts: [],
    users: [],
    topics: [],
    comments: {},
    loaded: false,
  },

  /* ── LOCALSTORAGE KEYS (our "browser-only database") ──────── */
  LOCAL_POSTS_KEY: "hh_local_posts",
  VOTES_KEY: "hh_votes",
  COMMENT_VOTES_KEY: "hh_comment_votes",
  SAVED_KEY: "hh_saved",
  LOCAL_COMMENTS_KEY: "hh_local_comments",
  DRAFT_KEY: "hh_draft",

  /* ── 1. LOAD ALL JSON DATA ─────────────────────────────────── */
  async loadAllData() {
    if (this.cache.loaded) return this.cache;

    try {
      const [posts, users, topics, comments] = await Promise.all([
        fetch("data/posts.json").then((r) => r.json()),
        fetch("data/users.json").then((r) => r.json()),
        fetch("data/topics.json").then((r) => r.json()),
        fetch("data/comments.json").then((r) => r.json()),
      ]);
      this.cache = { posts, users, topics, comments, loaded: true };
    } catch (err) {
      console.error("HelpHive: could not load data files.", err);
      if (window.HH_UI) {
        HH_UI.showToast(
          "Couldn't load site data. Are you running this through a local server?",
          "error"
        );
      }
    }
    return this.cache;
  },

  /* ── 2. LOCALSTORAGE OVERLAY HELPERS ───────────────────────── */
  getLocalPosts() {
    const raw = localStorage.getItem(this.LOCAL_POSTS_KEY);
    return raw ? JSON.parse(raw) : [];
  },
  saveLocalPosts(posts) {
    localStorage.setItem(this.LOCAL_POSTS_KEY, JSON.stringify(posts));
  },
  addLocalPost(post) {
    const local = this.getLocalPosts();
    local.push(post);
    this.saveLocalPosts(local);
  },

  getVotes() {
    const raw = localStorage.getItem(this.VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  },
  setVote(postId, direction) {
    const votes = this.getVotes();
    // Clicking the same direction again REMOVES the vote (toggle off)
    votes[postId] = votes[postId] === direction ? null : direction;
    localStorage.setItem(this.VOTES_KEY, JSON.stringify(votes));
    return votes[postId];
  },

  getCommentVotes() {
    const raw = localStorage.getItem(this.COMMENT_VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  },
  setCommentVote(commentId, direction) {
    const votes = this.getCommentVotes();
    votes[commentId] = votes[commentId] === direction ? null : direction;
    localStorage.setItem(this.COMMENT_VOTES_KEY, JSON.stringify(votes));
    return votes[commentId];
  },

  getSaved() {
    const raw = localStorage.getItem(this.SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  },
  toggleSaved(postId) {
    let saved = this.getSaved();
    const isSaved = saved.includes(postId);
    saved = isSaved ? saved.filter((id) => id !== postId) : [...saved, postId];
    localStorage.setItem(this.SAVED_KEY, JSON.stringify(saved));
    return !isSaved; // returns the NEW saved state
  },

  getLocalComments() {
    const raw = localStorage.getItem(this.LOCAL_COMMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  },
  addLocalComment(postId, comment) {
    const all = this.getLocalComments();
    if (!all[postId]) all[postId] = [];
    all[postId].push(comment);
    localStorage.setItem(this.LOCAL_COMMENTS_KEY, JSON.stringify(all));
  },

  /* ── 3. DATA LOOKUP HELPERS ─────────────────────────────────── */
  getAllPosts() {
    return [...this.cache.posts, ...this.getLocalPosts()];
  },
  getPostById(id) {
    return this.getAllPosts().find((p) => p.id === Number(id));
  },
  getUserById(id) {
    return this.cache.users.find((u) => u.id === Number(id));
  },
  getTopicById(id) {
    return this.cache.topics.find((t) => t.id === Number(id));
  },
  getCommentsForPost(postId) {
    const seed = this.cache.comments[String(postId)] || [];
    const local = this.getLocalComments()[postId] || [];
    return [...seed, ...local];
  },
  // Counts a post's comments INCLUDING nested replies, recursively.
  countComments(commentList) {
    let total = 0;
    commentList.forEach((c) => {
      total += 1 + this.countComments(c.replies || []);
    });
    return total;
  },

  // Applies the user's vote overlay on top of a post's base vote counts
  getEffectiveVotes(post) {
    const myVote = this.getVotes()[post.id];
    let up = post.upvotes;
    let down = post.downvotes;
    if (myVote === "up") up += 1;
    if (myVote === "down") down += 1;
    return { up, down, score: up - down, myVote: myVote || null };
  },

  /* ── 4. SORTING ──────────────────────────────────────────────
     "Hot" uses a simplified version of Reddit's ranking idea:
     score divided by how old the post is, so new+popular posts
     rise without OLD popular posts dominating forever.
  ──────────────────────────────────────────────────────────── */
  sortPosts(posts, sortType) {
    const withScores = posts.map((p) => {
      const { score } = this.getEffectiveVotes(p);
      const ageHours = Math.max(1, (Date.now() - new Date(p.timestamp)) / 36e5);
      return { post: p, score, ageHours };
    });

    switch (sortType) {
      case "new":
        withScores.sort((a, b) => new Date(b.post.timestamp) - new Date(a.post.timestamp));
        break;
      case "top":
        withScores.sort((a, b) => b.score - a.score);
        break;
      case "rising":
        // Favors posts with a lot of comments relative to their age
        withScores.sort((a, b) => {
          const aRise = this.countComments(this.getCommentsForPost(a.post.id)) / a.ageHours;
          const bRise = this.countComments(this.getCommentsForPost(b.post.id)) / b.ageHours;
          return bRise - aRise;
        });
        break;
      case "hot":
      default:
        withScores.sort((a, b) => b.score / Math.pow(b.ageHours, 1.2) - a.score / Math.pow(a.ageHours, 1.2));
        break;
    }
    return withScores.map((w) => w.post);
  },

  /* ── 5. RENDERING: POST CARD ──────────────────────────────────
     Builds the HTML for one post card used in feeds, profile
     lists, and the "related posts" sidebar.
  ──────────────────────────────────────────────────────────── */
  renderPostCard(post, index = 0) {
    const author = this.getUserById(post.authorId) || {};
    const topic = this.getTopicById(post.topicId) || {};
    const { up, down, myVote } = this.getEffectiveVotes(post);
    const commentTotal = this.countComments(this.getCommentsForPost(post.id));
    const typeBadge =
      post.type === "experience"
        ? `<span class="badge badge--answer">💡 Experience</span>`
        : `<span class="badge badge--question">❓ Question</span>`;

    return `
      <a href="post.html?id=${post.id}" class="post-card" style="animation-delay:${index * 60}ms">
        <div class="post-card__vote">
          <button class="vote-btn vote-btn--up ${myVote === "up" ? "voted" : ""}" data-post-id="${post.id}" data-direction="up" aria-label="Upvote">▲</button>
          <span class="vote-count" data-vote-count="${post.id}">${HH_UI.formatNumber(up - down)}</span>
          <button class="vote-btn vote-btn--down ${myVote === "down" ? "voted" : ""}" data-post-id="${post.id}" data-direction="down" aria-label="Downvote">▼</button>
        </div>
        <div class="post-card__body">
          <div class="post-card__meta">
            <span class="topic-tag" style="background:${topic.color}22; color:${topic.color}">${topic.icon || "📚"} ${topic.name || "General"}</span>
            ${typeBadge}
          </div>
          <h3 class="post-card__title">${HH_UI.escapeHTML(post.title)}</h3>
          <p class="post-card__excerpt">${HH_UI.escapeHTML(post.body).slice(0, 160)}${post.body.length > 160 ? "…" : ""}</p>
          <div class="post-card__footer">
            <span class="post-card__author">${author.displayName || "Anonymous"}${author.isExpert ? " ⭐" : ""}</span>
            <span class="post-card__time">${HH_UI.timeAgo(post.timestamp)}</span>
            <span class="post-card__stat">💬 ${commentTotal}</span>
          </div>
        </div>
      </a>
    `;
  },

  renderPostList(containerEl, posts) {
    if (!containerEl) return;
    if (posts.length === 0) {
      containerEl.innerHTML = "";
      return false; // tells the caller to show the "empty state" message
    }
    containerEl.innerHTML = posts.map((p, i) => this.renderPostCard(p, i)).join("");
    return true;
  },

  /* ── 6. VOTE BUTTON HANDLING (works for both posts & comments) ─
     We use EVENT DELEGATION: one listener on <body> instead of
     one per button, because buttons get created dynamically.
  ──────────────────────────────────────────────────────────── */
  initVoteDelegation() {
    document.body.addEventListener("click", (e) => {
      const voteBtn = e.target.closest(".vote-btn[data-post-id]");
      if (voteBtn) {
        const postId = Number(voteBtn.dataset.postId);
        const direction = voteBtn.dataset.direction;
        this.setVote(postId, direction);
        this.refreshVoteDisplays(postId);
        return;
      }
      const commentVoteBtn = e.target.closest(".vote-btn[data-comment-id]");
      if (commentVoteBtn) {
        const commentId = Number(commentVoteBtn.dataset.commentId);
        const direction = commentVoteBtn.dataset.direction;
        this.setCommentVote(commentId, direction);
        // Comments are simpler — we just re-render the whole comment list
        const reRender = document.getElementById("commentList");
        if (reRender && window.__currentPostId) this.renderCommentsSection(window.__currentPostId);
      }
    });
  },

  // After a vote, update every matching vote count on the page
  // (the same post might appear in a feed AND nowhere else — but
  // this keeps things correct if a post appears more than once).
  refreshVoteDisplays(postId) {
    const post = this.getPostById(postId);
    if (!post) return;
    const { up, down, myVote } = this.getEffectiveVotes(post);

    document.querySelectorAll(`[data-vote-count="${postId}"]`).forEach((el) => {
      el.textContent = HH_UI.formatNumber(up - down);
      el.classList.add("vote-count--animating");
      el.addEventListener("animationend", () => el.classList.remove("vote-count--animating"), { once: true });
    });
    document.querySelectorAll(`.vote-btn[data-post-id="${postId}"]`).forEach((btn) => {
      const isThisDirection = btn.dataset.direction === myVote;
      btn.classList.toggle("voted", isThisDirection);
    });
  },

  /* ════════════════════════════════════════════════════════════
     PAGE-SPECIFIC RENDERERS
     Each one only runs if the matching element exists on the page.
  ════════════════════════════════════════════════════════════ */

  /* ── INDEX & TOPIC PAGE: the main feed ────────────────────── */
  initFeedPage() {
    const postListEl = document.getElementById("postList");
    if (!postListEl) return;

    const topicBanner = document.getElementById("topicBanner");
    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get("id");

    let currentSort = "hot";

    const renderCurrentFeed = (filterText = "") => {
      let posts = this.getAllPosts();

      if (topicBanner && topicId) {
        posts = posts.filter((p) => p.topicId === Number(topicId));
      }
      if (filterText) {
        const q = filterText.toLowerCase();
        posts = posts.filter((p) => p.title.toLowerCase().includes(q));
      }

      posts = this.sortPosts(posts, currentSort);
      const hasPosts = this.renderPostList(postListEl, posts);

      const emptyEl = document.getElementById("topicPostsEmpty");
      if (emptyEl) emptyEl.classList.toggle("hidden", hasPosts);
    };

    // Sort tab buttons
    document.querySelectorAll(".feed__tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".feed__tab").forEach((t) => {
          t.classList.remove("feed__tab--active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("feed__tab--active");
        tab.setAttribute("aria-selected", "true");
        currentSort = tab.dataset.sort;
        renderCurrentFeed(document.getElementById("searchInput")?.value || "");
      });
    });

    // Navbar search filters the feed live as you type (Enter not required)
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => renderCurrentFeed(searchInput.value));
    }

    // If we're on topic.html, fill in the banner + sidebar widgets
    if (topicBanner && topicId) {
      this.renderTopicBanner(Number(topicId));
    }

    // If we're on index.html, fill the sidebar widgets + hero stats
    if (document.getElementById("sidebarTopics")) {
      this.renderHomeSidebar();
    }

    renderCurrentFeed();
  },

  renderTopicBanner(topicId) {
    const topic = this.getTopicById(topicId);
    if (!topic) return;

    document.getElementById("topicBanner").style.setProperty("--topic-color", topic.color);
    document.getElementById("topicIcon").textContent = topic.icon;
    document.getElementById("topicName").textContent = topic.name;
    document.getElementById("topicDesc").textContent = topic.description;

    const postsInTopic = this.getAllPosts().filter((p) => p.topicId === topicId);
    const realPostCount = topic.postCount + postsInTopic.length;
    HH_UI.animateNumber(document.getElementById("topicPostCount"), 0, realPostCount);
    HH_UI.animateNumber(document.getElementById("topicFollowers"), 0, topic.followerCount);

    const aboutTitle = document.getElementById("topicAboutTitle");
    const aboutDesc = document.getElementById("topicAboutDesc");
    if (aboutTitle) aboutTitle.textContent = `About ${topic.name}`;
    if (aboutDesc) aboutDesc.textContent = topic.description;

    // Join button — purely visual toggle, stored per-topic in localStorage
    const joinBtn = document.getElementById("joinTopicBtn");
    const joinedKey = `hh_joined_${topicId}`;
    const isJoined = localStorage.getItem(joinedKey) === "true";
    const setJoinedUI = (joined) => {
      joinBtn.textContent = joined ? "✓ Joined" : "+ Join Topic";
      joinBtn.classList.toggle("btn--ghost", joined);
      joinBtn.classList.toggle("btn--primary", !joined);
    };
    setJoinedUI(isJoined);
    joinBtn.addEventListener("click", () => {
      const nowJoined = localStorage.getItem(joinedKey) !== "true";
      localStorage.setItem(joinedKey, nowJoined);
      setJoinedUI(nowJoined);
      HH_UI.showToast(nowJoined ? `Joined ${topic.name}!` : `Left ${topic.name}.`, "success");
    });

    // Top contributors: count posts per author within this topic
    const counts = {};
    postsInTopic.forEach((p) => { counts[p.authorId] = (counts[p.authorId] || 0) + 1; });
    const topAuthors = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([authorId]) => this.getUserById(authorId));

    const contributorsEl = document.getElementById("topicContributors");
    if (contributorsEl) {
      contributorsEl.innerHTML = topAuthors
        .map(
          (u) => `
        <div class="expert-mini">
          <div class="expert-mini__avatar">${u.avatarLetter}</div>
          <div>
            <div class="expert-mini__name">${HH_UI.escapeHTML(u.displayName)}</div>
            <div class="expert-mini__field">${u.isExpert ? u.expertField : "Community member"}</div>
          </div>
        </div>`
        )
        .join("") || `<p class="sidebar-widget__desc">No contributors yet — be the first!</p>`;
    }

    // Related topics: just show 3 other topics
    const relatedEl = document.getElementById("relatedTopics");
    if (relatedEl) {
      relatedEl.innerHTML = this.cache.topics
        .filter((t) => t.id !== topicId)
        .slice(0, 3)
        .map((t) => `<li><a href="topic.html?id=${t.id}" class="topic-list__item"><span>${t.icon} ${t.name}</span></a></li>`)
        .join("");
    }
  },

  renderHomeSidebar() {
    // Hero + sidebar stat counters
    const statPairs = [
      ["statMembers", 12400], ["statExperts", 840],
      ["sidebarMembers", 12400], ["sidebarOnline", 247], ["sidebarPosts", 3891 + this.getLocalPosts().length],
    ];
    statPairs.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) HH_UI.animateNumber(el, 0, value);
    });

    // Trending topics — top 5 by postCount
    const trending = [...this.cache.topics].sort((a, b) => b.postCount - a.postCount).slice(0, 5);
    const sidebarTopics = document.getElementById("sidebarTopics");
    if (sidebarTopics) {
      sidebarTopics.innerHTML = trending
        .map(
          (t) => `
        <li class="topic-list__item">
          <a href="topic.html?id=${t.id}" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:6px 0;">
            <span>${t.icon} ${t.name}</span>
            <span style="color:var(--color-text-muted);font-size:var(--text-xs)">${HH_UI.formatNumber(t.postCount)}</span>
          </a>
        </li>`
        )
        .join("");
    }

    // Featured experts — 3 random-ish experts
    const experts = this.cache.users.filter((u) => u.isExpert).slice(0, 3);
    const sidebarExperts = document.getElementById("sidebarExperts");
    if (sidebarExperts) {
      sidebarExperts.innerHTML = experts
        .map(
          (u) => `
        <a href="profile.html?id=${u.id}" class="expert-mini" style="text-decoration:none;color:inherit;">
          <div class="expert-mini__avatar">${u.avatarLetter}</div>
          <div>
            <div class="expert-mini__name">${HH_UI.escapeHTML(u.displayName)}</div>
            <div class="expert-mini__field">${HH_UI.escapeHTML(u.expertField)}</div>
          </div>
        </a>`
        )
        .join("");
    }
  },

  /* ── POST DETAIL PAGE ──────────────────────────────────────── */
  initPostDetailPage() {
    const detailEl = document.getElementById("postDetail");
    if (!detailEl) return;

    const postId = Number(new URLSearchParams(window.location.search).get("id")) || this.getAllPosts()[0]?.id;
    window.__currentPostId = postId; // used by the vote-delegation handler for comments
    const post = this.getPostById(postId);

    if (!post) {
      detailEl.innerHTML = `<p>This post couldn't be found.</p>`;
      return;
    }

    const author = this.getUserById(post.authorId) || {};
    const topic = this.getTopicById(post.topicId) || {};
    const { up, down, myVote } = this.getEffectiveVotes(post);

    document.getElementById("breadcrumbTopic").textContent = topic.name || "Topic";
    document.getElementById("breadcrumbTopic").href = `topic.html?id=${topic.id || ""}`;
    document.getElementById("breadcrumbTitle").textContent = post.title;

    document.getElementById("postTopic").textContent = `${topic.icon || "📚"} ${topic.name || "General"}`;
    document.getElementById("postTopic").href = `topic.html?id=${topic.id || ""}`;
    document.getElementById("postTitle").textContent = post.title;
    document.getElementById("postAuthorAvatar").textContent = author.avatarLetter || "U";
    document.getElementById("postAuthorName").textContent = author.displayName || "Anonymous";
    document.getElementById("postTime").textContent = HH_UI.timeAgo(post.timestamp);
    if (author.isExpert) document.getElementById("postExpertBadge").classList.remove("hidden");

    document.getElementById("postBody").innerHTML = HH_UI.renderFormattedText(post.body);
    document.getElementById("postTags").innerHTML = post.tags
      .map((t) => `<span class="tag">#${HH_UI.escapeHTML(t)}</span>`)
      .join("");

    document.getElementById("postVoteCount").textContent = HH_UI.formatNumber(up - down);
    document.getElementById("postVoteCount").dataset.voteCount = post.id;
    document.getElementById("postUpvote").dataset.postId = post.id;
    document.getElementById("postUpvote").dataset.direction = "up";
    document.getElementById("postDownvote").dataset.postId = post.id;
    document.getElementById("postDownvote").dataset.direction = "down";
    document.getElementById("postUpvote").classList.toggle("voted", myVote === "up");
    document.getElementById("postDownvote").classList.toggle("voted", myVote === "down");
    // The vote-count element needs the same data attribute our delegation looks for
    document.getElementById("postVoteCount").setAttribute("data-vote-count", post.id);

    // Author sidebar card
    document.getElementById("authorMiniAvatar").textContent = author.avatarLetter || "U";
    document.getElementById("authorMiniName").textContent = author.displayName || "Anonymous";
    document.getElementById("authorMiniName").href = `profile.html?id=${author.id || ""}`;
    document.getElementById("authorMiniField").textContent = author.isExpert ? author.expertField : "Community member";
    if (author.isExpert) document.getElementById("authorMiniExpert").classList.remove("hidden");
    document.getElementById("authorKarma").textContent = HH_UI.formatNumber(author.karma || 0);
    document.getElementById("authorPosts").textContent = this.getAllPosts().filter((p) => p.authorId === author.id).length;

    // Related posts — same topic, excluding this post
    const related = this.getAllPosts().filter((p) => p.topicId === post.topicId && p.id !== post.id).slice(0, 4);
    document.getElementById("relatedPosts").innerHTML = related
      .map((p) => `<li><a href="post.html?id=${p.id}">${HH_UI.escapeHTML(p.title)}</a></li>`)
      .join("") || `<li><span style="color:var(--color-text-muted)">No related posts yet.</span></li>`;

    // Save (bookmark) button
    const saveBtn = document.getElementById("savePostBtn");
    const updateSaveBtn = () => {
      const isSaved = this.getSaved().includes(post.id);
      saveBtn.textContent = isSaved ? "✅ Saved" : "🔖 Save";
    };
    updateSaveBtn();
    saveBtn.addEventListener("click", () => {
      const nowSaved = this.toggleSaved(post.id);
      updateSaveBtn();
      HH_UI.showToast(nowSaved ? "Post saved!" : "Removed from saved.", "success");
    });

    // Report button — demo only
    document.getElementById("reportPostBtn").addEventListener("click", () => {
      HH_UI.showToast("Thanks — our team will review this post.", "info");
    });

    // Share modal
    const shareBtn = document.getElementById("sharePostBtn");
    const shareInput = document.getElementById("shareLinkInput");
    shareBtn.addEventListener("click", () => {
      shareInput.value = window.location.href;
      HH_UI.openModal("shareModal");
    });
    document.getElementById("closeShareModal").addEventListener("click", () => HH_UI.closeModal("shareModal"));
    document.getElementById("shareModalBackdrop").addEventListener("click", () => HH_UI.closeModal("shareModal"));
    document.getElementById("copyLinkBtn").addEventListener("click", () => {
      navigator.clipboard?.writeText(shareInput.value);
      HH_UI.showToast("Link copied!", "success");
    });
    document.getElementById("shareTwitter").href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(post.title)}`;
    document.getElementById("shareWhatsApp").href = `https://wa.me/?text=${encodeURIComponent(post.title + " " + window.location.href)}`;

    // Comments
    this.renderCommentsSection(post.id);
    this.initReplyBox(post.id);
  },

  renderCommentTree(comments) {
    if (!comments || comments.length === 0) return "";
    return comments
      .map((c) => {
        const author = this.getUserById(c.authorId) || {};
        const myVote = this.getCommentVotes()[c.id];
        const voteCount = c.upvotes + (myVote === "up" ? 1 : 0);
        const typeBadge = c.type === "answer" ? `<span class="badge badge--answer" style="margin-left:auto">Answer</span>` : "";

        return `
        <div class="comment">
          <div class="comment__vote">
            <button class="vote-btn vote-btn--up ${myVote === "up" ? "voted" : ""}" data-comment-id="${c.id}" data-direction="up" aria-label="Upvote comment">▲</button>
            <span class="vote-count">${HH_UI.formatNumber(voteCount)}</span>
          </div>
          <div class="comment__body">
            <div class="comment__header">
              <div class="comment__avatar">${author.avatarLetter || "U"}</div>
              <span class="comment__author">${HH_UI.escapeHTML(author.displayName || "Anonymous")}</span>
              ${author.isExpert ? '<span class="badge badge--expert">⭐ Expert</span>' : ""}
              <span class="comment__time">${HH_UI.timeAgo(c.timestamp)}</span>
              ${typeBadge}
            </div>
            <p class="comment__text">${HH_UI.escapeHTML(c.text)}</p>
            <div class="comment__actions">
              <button class="btn btn--ghost btn--small">↩ Reply</button>
              <button class="btn btn--ghost btn--small">📤 Share</button>
            </div>
            ${c.replies && c.replies.length > 0 ? `<div class="comment__replies">${this.renderCommentTree(c.replies)}</div>` : ""}
          </div>
        </div>`;
      })
      .join("");
  },

  renderCommentsSection(postId) {
    const comments = this.getCommentsForPost(postId);
    const total = this.countComments(comments);
    document.getElementById("commentCount").textContent = total;
    document.getElementById("commentList").innerHTML =
      this.renderCommentTree(comments) ||
      `<p style="color:var(--color-text-muted);padding:var(--space-6) 0;">No answers yet. Be the first to help!</p>`;
  },

  initReplyBox(postId) {
    const input = document.getElementById("replyInput");
    const submitBtn = document.getElementById("submitReply");
    const avatarEl = document.getElementById("replyAvatar");
    let replyType = "answer";

    const currentUser = window.HH_AUTH ? HH_AUTH.getCurrentUser() : null;
    if (currentUser) avatarEl.textContent = currentUser.avatarLetter || "U";

    document.querySelectorAll(".reply-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".reply-type-btn").forEach((b) => b.classList.remove("reply-type-btn--active"));
        btn.classList.add("reply-type-btn--active");
        replyType = btn.dataset.type;
      });
    });

    input.addEventListener("input", () => {
      submitBtn.disabled = input.value.trim().length === 0;
    });

    submitBtn.addEventListener("click", () => {
      if (!currentUser) {
        HH_UI.showToast("Please sign in to reply.", "error");
        window.location.href = "login.html";
        return;
      }
      const accounts = HH_AUTH.getAccounts();
      // Find this account's numeric "seed" author id if they happen to share
      // a username with a seed user, otherwise just use author id 3 (a
      // generic demo member) so the comment still renders nicely.
      const fakeAuthorId = 3;

      const newComment = {
        id: Date.now(),
        authorId: fakeAuthorId,
        type: replyType,
        text: input.value.trim(),
        upvotes: 0,
        timestamp: new Date().toISOString(),
        replies: [],
      };
      this.addLocalComment(postId, newComment);
      input.value = "";
      submitBtn.disabled = true;
      this.renderCommentsSection(postId);
      HH_UI.showToast("Your reply was posted!", "success");
    });
  },

  /* ── EXPLORE PAGE ──────────────────────────────────────────── */
  initExplorePage() {
    const gridEl = document.getElementById("topicGrid");
    if (!gridEl) return;

    const renderGrid = (filterText = "") => {
      let topics = this.cache.topics;
      if (filterText) {
        const q = filterText.toLowerCase();
        topics = topics.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      }
      gridEl.innerHTML = topics
        .map(
          (t) => `
        <a href="topic.html?id=${t.id}" class="topic-card" style="--card-color:${t.color}">
          <span class="topic-card__icon">${t.icon}</span>
          <h3 class="topic-card__name">${HH_UI.escapeHTML(t.name)}</h3>
          <p class="topic-card__count">${HH_UI.formatNumber(t.postCount)} posts</p>
        </a>`
        )
        .join("");

      document.getElementById("topicCount").textContent = `${topics.length} topics`;
      document.getElementById("topicEmpty").classList.toggle("hidden", topics.length > 0);
    };

    const searchInput = document.getElementById("topicSearchInput");
    searchInput.addEventListener("input", () => renderGrid(searchInput.value));
    renderGrid();

    // Expert spotlight
    const experts = this.cache.users.filter((u) => u.isExpert);
    document.getElementById("expertScroll").innerHTML = experts
      .map(
        (u) => `
      <div class="expert-card" role="listitem">
        <div class="expert-card__avatar">${u.avatarLetter}</div>
        <span class="badge badge--expert">⭐ Expert</span>
        <h3 class="expert-card__name">${HH_UI.escapeHTML(u.displayName)}</h3>
        <p class="expert-card__field">${HH_UI.escapeHTML(u.expertField)}</p>
        <p class="expert-card__bio">${HH_UI.escapeHTML(u.bio)}</p>
        <a href="profile.html?id=${u.id}" class="btn btn--ghost btn--small">View profile</a>
      </div>`
      )
      .join("");
  },

  /* ── PROFILE PAGE ──────────────────────────────────────────── */
  initProfilePage() {
    const nameEl = document.getElementById("profileName");
    if (!nameEl) return;

    const urlId = new URLSearchParams(window.location.search).get("id");
    const currentUser = window.HH_AUTH ? HH_AUTH.getCurrentUser() : null;

    // If no ?id= is given, show the logged-in user (or redirect to login)
    let profileUser;
    if (urlId) {
      profileUser = this.getUserById(Number(urlId));
    } else if (currentUser) {
      // Adapt the localStorage session shape to look like a seed user object
      profileUser = {
        id: "me",
        displayName: `${currentUser.firstName} ${currentUser.lastName}`,
        avatarLetter: currentUser.avatarLetter,
        bio: "Welcome to your HelpHive profile!",
        isExpert: currentUser.isExpert,
        expertField: currentUser.expertField,
        karma: 0,
        badges: ["New Member"],
        joinDate: currentUser.joinDate,
        followers: 0,
      };
    } else {
      window.location.href = "login.html";
      return;
    }

    document.getElementById("profileAvatar").textContent = profileUser.avatarLetter || "U";
    document.getElementById("profileName").textContent = profileUser.displayName;
    document.getElementById("profileBio").textContent = profileUser.bio || "";
    document.getElementById("profileJoined").textContent = new Date(profileUser.joinDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    if (profileUser.isExpert) {
      document.getElementById("profileExpertBadge").classList.remove("hidden");
      document.getElementById("profileField").textContent = profileUser.expertField;
    }

    HH_UI.animateNumber(document.getElementById("statKarma"), 0, profileUser.karma || 0);
    HH_UI.animateNumber(document.getElementById("statFollowers"), 0, profileUser.followers || 0);

    const myPosts = this.getAllPosts().filter((p) => p.authorId === profileUser.id);
    HH_UI.animateNumber(document.getElementById("statPostsCount"), 0, myPosts.filter((p) => p.type !== "experience" || true).length);
    HH_UI.animateNumber(document.getElementById("statAnswers"), 0, 0);

    // Hide follow/message buttons when viewing your OWN profile
    const isOwnProfile = !urlId || (currentUser && profileUser.id === "me");
    if (isOwnProfile) document.getElementById("profileActions").classList.add("hidden");
    else {
      document.getElementById("followBtn").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        const nowFollowing = btn.textContent.trim() === "Follow";
        btn.textContent = nowFollowing ? "✓ Following" : "Follow";
        HH_UI.showToast(nowFollowing ? "You're now following this person." : "Unfollowed.", "info");
      });
      document.getElementById("messageBtn").addEventListener("click", () => {
        HH_UI.showToast("Messaging isn't available in this demo.", "info");
      });
    }

    // Badges shelf
    document.getElementById("badgesShelf").innerHTML = (profileUser.badges || [])
      .map((b) => `<span class="earned-badge">🏅 ${HH_UI.escapeHTML(b)}</span>`)
      .join("");

    // Tabs: Posts / Answers / Saved
    document.querySelectorAll(".profile-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".profile-tab").forEach((t) => {
          t.classList.remove("profile-tab--active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("profile-tab--active");
        tab.setAttribute("aria-selected", "true");

        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
        document.getElementById(`panel-${tab.dataset.tab}`).classList.remove("hidden");
      });
    });

    const postsHasContent = this.renderPostList(document.getElementById("userPostList"), myPosts);
    document.getElementById("postsEmpty").classList.toggle("hidden", postsHasContent);

    document.getElementById("answersEmpty").classList.remove("hidden");

    if (isOwnProfile) {
      const savedPosts = this.getSaved().map((id) => this.getPostById(id)).filter(Boolean);
      const savedHasContent = this.renderPostList(document.getElementById("userSavedList"), savedPosts);
      document.getElementById("savedEmpty").classList.toggle("hidden", savedHasContent);
    } else {
      document.getElementById("savedTab").classList.add("hidden");
    }
  },

  /* ── CREATE POST PAGE ──────────────────────────────────────── */
  initCreatePostPage() {
    const editor = document.getElementById("postEditor");
    if (!editor) return;

    let postType = "question";
    const typeQuestionBtn = document.getElementById("typeQuestion");
    const typeExperienceBtn = document.getElementById("typeExperience");
    typeQuestionBtn.addEventListener("click", () => {
      postType = "question";
      typeQuestionBtn.classList.add("post-type-btn--active");
      typeExperienceBtn.classList.remove("post-type-btn--active");
    });
    typeExperienceBtn.addEventListener("click", () => {
      postType = "experience";
      typeExperienceBtn.classList.add("post-type-btn--active");
      typeQuestionBtn.classList.remove("post-type-btn--active");
    });

    // Fill the topic dropdown from topics.json
    const topicSelect = document.getElementById("postTopic");
    this.cache.topics.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.icon} ${t.name}`;
      topicSelect.appendChild(opt);
    });

    // Title character counter
    const titleInput = document.getElementById("postTitle");
    const titleCount = document.getElementById("titleCount");
    titleInput.addEventListener("input", () => {
      titleCount.textContent = `${titleInput.value.length} / 300`;
    });

    // Formatting toolbar — wraps the SELECTED text in the textarea
    // with markdown-style symbols. This is plain string editing,
    // no external library needed.
    const bodyTextarea = document.getElementById("postBody");
    const wrapSelection = (before, after = before) => {
      const start = bodyTextarea.selectionStart;
      const end = bodyTextarea.selectionEnd;
      const selected = bodyTextarea.value.slice(start, end) || "text";
      const newValue = bodyTextarea.value.slice(0, start) + before + selected + after + bodyTextarea.value.slice(end);
      bodyTextarea.value = newValue;
      bodyTextarea.focus();
    };
    document.querySelectorAll(".toolbar-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switch (btn.dataset.format) {
          case "bold": wrapSelection("**"); break;
          case "italic": wrapSelection("*"); break;
          case "code": wrapSelection("`"); break;
          case "link": wrapSelection("[", "](https://)"); break;
          case "bullet": wrapSelection("\n- ", ""); break;
        }
      });
    });

    // Preview toggle
    const previewBtn = document.getElementById("previewToggle");
    const previewEl = document.getElementById("editorPreview");
    previewBtn.addEventListener("click", () => {
      const showingPreview = !previewEl.classList.contains("hidden");
      if (showingPreview) {
        previewEl.classList.add("hidden");
        bodyTextarea.classList.remove("hidden");
        previewBtn.textContent = "👁️ Preview";
      } else {
        previewEl.innerHTML = HH_UI.renderFormattedText(bodyTextarea.value || "Nothing written yet...");
        previewEl.classList.remove("hidden");
        bodyTextarea.classList.add("hidden");
        previewBtn.textContent = "✏️ Edit";
      }
    });

    // Tags input
    const tagInputBox = document.getElementById("tagInputBox");
    const tagInput = document.getElementById("tagInput");
    let tags = [];
    const renderTags = () => {
      tagInputBox.querySelectorAll(".tag-pill").forEach((el) => el.remove());
      tags.forEach((tag) => {
        const pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.innerHTML = `${HH_UI.escapeHTML(tag)} <span class="tag-pill__remove" data-tag="${tag}">✕</span>`;
        tagInputBox.insertBefore(pill, tagInput);
      });
    };
    tagInput.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === ",") && tagInput.value.trim()) {
        e.preventDefault();
        const value = tagInput.value.trim().replace(",", "");
        if (tags.length < 5 && !tags.includes(value)) {
          tags.push(value);
          renderTags();
        }
        tagInput.value = "";
      }
    });
    tagInputBox.addEventListener("click", (e) => {
      if (e.target.classList.contains("tag-pill__remove")) {
        tags = tags.filter((t) => t !== e.target.dataset.tag);
        renderTags();
      }
    });

    // Save draft (just localStorage, retrievable on next visit)
    document.getElementById("saveDraftBtn").addEventListener("click", () => {
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify({
        title: titleInput.value, topicId: topicSelect.value, body: bodyTextarea.value, tags,
      }));
      HH_UI.showToast("Draft saved!", "success");
    });

    // Load any existing draft when the page opens
    const savedDraft = localStorage.getItem(this.DRAFT_KEY);
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      titleInput.value = draft.title || "";
      if (draft.topicId) topicSelect.value = draft.topicId;
      bodyTextarea.value = draft.body || "";
      tags = draft.tags || [];
      renderTags();
      titleCount.textContent = `${titleInput.value.length} / 300`;
    }

    // Publish
    document.getElementById("submitPostBtn").addEventListener("click", () => {
      const title = titleInput.value.trim();
      const topicId = Number(topicSelect.value);
      const body = bodyTextarea.value.trim();

      document.getElementById("titleError").classList.toggle("hidden", title.length > 0);
      document.getElementById("topicError").classList.toggle("hidden", !!topicId);
      document.getElementById("bodyError").classList.toggle("hidden", body.length > 0);
      if (!title || !topicId || !body) return;

      const currentUser = HH_AUTH.getCurrentUser();
      const allIds = this.getAllPosts().map((p) => p.id);
      const newPost = {
        id: Math.max(...allIds) + 1,
        title,
        body,
        authorId: 3, // demo accounts post as a generic seed author so avatars/profiles still work
        topicId,
        type: postType,
        upvotes: 1,
        downvotes: 0,
        timestamp: new Date().toISOString(),
        tags,
      };
      this.addLocalPost(newPost);
      localStorage.removeItem(this.DRAFT_KEY);
      HH_UI.showToast("Your post is live!", "success");
      setTimeout(() => { window.location.href = `post.html?id=${newPost.id}`; }, 500);
    });
  },

  /* ── KICK EVERYTHING OFF ──────────────────────────────────── */
  async init() {
    await this.loadAllData();
    this.initVoteDelegation();
    this.initFeedPage();
    this.initPostDetailPage();
    this.initExplorePage();
    this.initProfilePage();
    this.initCreatePostPage();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  HH_POSTS.init();
});
