let characters = [];
let videos = [];
let videoTopics = [];
let songs = [];

const els = {
  grid: document.querySelector("#characterGrid"),
  search: document.querySelector("#searchInput"),
  count: document.querySelector("#resultCount"),
  characterResultMeta: document.querySelector("#characterResultMeta"),
  characterExpand: document.querySelector("#characterExpand"),
  characterCollapse: document.querySelector("#characterCollapse"),
  empty: document.querySelector("#emptyState"),
  dialog: document.querySelector("#characterDialog"),
  dialogContent: document.querySelector("#dialogContent"),
  videoSearch: document.querySelector("#videoSearchInput"),
  videoSort: document.querySelector("#videoSort"),
  videoTotal: document.querySelector("#videoTotal"),
  videoResultMeta: document.querySelector("#videoResultMeta"),
  videoGrid: document.querySelector("#videoGrid"),
  videoEmpty: document.querySelector("#videoEmpty"),
  videoLoadMore: document.querySelector("#videoLoadMore"),
  topicFilters: document.querySelector("#topicFilters"),
  songSearch: document.querySelector("#songSearchInput"),
  songTotal: document.querySelector("#songTotal"),
  songResultMeta: document.querySelector("#songResultMeta"),
  songGrid: document.querySelector("#songGrid"),
  songEmpty: document.querySelector("#songEmpty"),
  songExpand: document.querySelector("#songExpand"),
  songCollapse: document.querySelector("#songCollapse")
};

const CHARACTER_FOLDED_COUNT = 12;
const SONG_FOLDED_COUNT = 6;
let activeFilter = "all";
let activeVideoChannel = "all";
let activeTopic = "all";
let visibleCharacterCount = CHARACTER_FOLDED_COUNT;
let visibleSongCount = SONG_FOLDED_COUNT;
let visibleVideoCount = 24;
let favorites = new Set(JSON.parse(localStorage.getItem("yatsu-favorites") || "[]"));

const normalize = value => value.toLowerCase().normalize("NFKC").replace(/\s/g, "");
const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const thumbnailUrl = videoId => `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;

const mobileNavLinks = [...document.querySelectorAll(".mobile-nav a")];
const mobileNavSections = mobileNavLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
let mobileNavFrame = 0;

function updateMobileNav() {
  mobileNavFrame = 0;
  const marker = window.scrollY + window.innerHeight * .38;
  const reachedSections = mobileNavSections.filter(section => section.offsetTop <= marker);
  const active = reachedSections[reachedSections.length - 1];
  mobileNavLinks.forEach(link => {
    const selected = active && link.getAttribute("href") === `#${active.id}`;
    selected ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current");
  });
}

window.addEventListener("scroll", () => {
  if (!mobileNavFrame) mobileNavFrame = requestAnimationFrame(updateMobileNav);
}, { passive: true });
window.addEventListener("resize", updateMobileNav);

function filteredCharacters() {
  const query = normalize(els.search.value);
  return characters.filter(character => {
    const haystack = normalize([character.name, character.kana, ...(character.aliases || []), character.summary, ...character.tags, ...(character.facts || []).flatMap(fact => [fact.label, fact.value])].join(" "));
    const matchesQuery = !query || haystack.includes(query);
    const matchesFilter = activeFilter === "all"
      || (activeFilter === "group" && character.entityType === "group")
      || (activeFilter === "favorite" && favorites.has(character.id))
      || (activeFilter !== "group" && character.channel === activeFilter)
      || (activeFilter === "island" && character.channelLabel.includes("ISLAND"));
    return matchesQuery && matchesFilter;
  });
}

function render({ reset = false } = {}) {
  if (reset) visibleCharacterCount = CHARACTER_FOLDED_COUNT;
  const matches = filteredCharacters();
  const visible = matches.slice(0, visibleCharacterCount);
  els.count.textContent = matches.length;
  els.characterResultMeta.textContent = `${matches.length.toLocaleString("ja-JP")}件中${visible.length.toLocaleString("ja-JP")}件を表示`;
  els.empty.hidden = matches.length !== 0;
  els.characterExpand.hidden = visible.length >= matches.length;
  els.characterExpand.textContent = `すべて表示（残り${Math.max(matches.length - visible.length, 0).toLocaleString("ja-JP")}件）`;
  els.characterExpand.setAttribute("aria-expanded", String(visible.length >= matches.length));
  els.characterCollapse.hidden = visibleCharacterCount <= CHARACTER_FOLDED_COUNT;
  els.grid.innerHTML = visible.map(character => {
    const firstVideo = character.relatedVideos?.[0];
    return `
    <article class="character-card" style="--card-color:${character.color};--accent:${character.channel === "island" ? "#ff6b35" : "#2f66ef"}">
      ${firstVideo ? `<div class="character-thumbnail"><img src="${thumbnailUrl(firstVideo.id)}" alt="${escapeHTML(character.name)}の初回掲載動画のサムネイル" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="480" height="360"></div>` : `<div class="character-thumbnail is-placeholder" aria-label="サムネイル準備中"><span>${escapeHTML(character.symbol)}</span></div>`}
      <div class="card-top">
        <span class="channel-badge">${escapeHTML(character.channelLabel)}</span>
        <button class="favorite-button" type="button" data-favorite="${character.id}" aria-label="${escapeHTML(character.name)}をお気に入り${favorites.has(character.id) ? "から外す" : "に追加"}" aria-pressed="${favorites.has(character.id)}">${favorites.has(character.id) ? "★" : "☆"}</button>
      </div>
      <h3>${escapeHTML(character.name)}</h3>
      <p>${escapeHTML(character.summary)}</p>
      <div class="tag-list">${character.tags.slice(0, 3).map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("")}</div>
      <button class="card-open" type="button" data-open="${character.id}" aria-label="${escapeHTML(character.name)}の詳細を見る">詳細を見る</button>
    </article>
  `;}).join("");

  els.grid.querySelectorAll(".character-thumbnail img").forEach(image => {
    image.addEventListener("error", () => image.closest(".character-thumbnail")?.classList.add("is-unavailable"), { once: true });
  });
}

function openCharacter(id) {
  const character = characters.find(item => item.id === id);
  if (!character) return;
  const relatedVideos = character.relatedVideos?.length
    ? character.relatedVideos
    : character.video ? [{ title: "公式動画", url: character.video }] : [];
  els.dialogContent.innerHTML = `
    <div class="dialog-body">
      <div class="dialog-hero">
        <div class="character-symbol" style="--card-color:${character.color}" aria-hidden="true">${escapeHTML(character.symbol)}</div>
        <div><p class="eyebrow">${escapeHTML(character.channelLabel)}</p><h2 id="dialogTitle">${escapeHTML(character.name)}</h2><div class="tag-list">${character.tags.map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("")}</div></div>
      </div>
      <p class="dialog-description">${escapeHTML(character.detail)}</p>
      <section class="sketch-style"><span>どんなネタ？</span><p>${escapeHTML(character.sketchStyle || character.summary)}</p></section>
      <dl class="dialog-meta"><dt>種別</dt><dd>${character.entityType === "group" ? "コンビ・ユニット" : "キャラクター"}</dd><dt>初登場の目印</dt><dd>${escapeHTML(character.debut)}</dd><dt>掲載方針</dt><dd>公式YouTube動画へのリンク</dd></dl>
      ${character.facts?.length ? `<div class="fact-list" aria-label="動画内で確認した情報"><h3>動画内で確認した情報</h3>${character.facts.map(fact => `<a href="${escapeHTML(fact.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHTML(fact.label)}</strong><span>${escapeHTML(fact.value)}</span><small>該当場面を見る ↗</small></a>`).join("")}</div>` : ""}
      <div class="video-list" aria-label="関連する公式動画">
        <h3>関連する公式動画</h3>
        ${relatedVideos.map((video, index) => `<a class="button video-link" href="${escapeHTML(video.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(video.title || `公式動画 ${index + 1}`)} ↗</a>`).join("")}
      </div>
      <p class="data-note">紹介文は動画タイトルと公開内容をもとに、本サイトが独自に要約したものです。誤りがある場合は今後の更新で修正します。</p>
    </div>`;
  els.dialog.showModal();
}

function openRandom() {
  const pool = filteredCharacters().length ? filteredCharacters() : characters;
  openCharacter(pool[Math.floor(Math.random() * pool.length)].id);
}

function filteredSongs() {
  const query = normalize(els.songSearch.value);
  return songs.filter(song => {
    const haystack = normalize([song.title, ...(song.aliases || []), song.performer, song.summary, ...(song.tags || []), song.videoTitle].join(" "));
    return !query || haystack.includes(query);
  });
}

function renderSongs({ reset = false } = {}) {
  if (reset) visibleSongCount = SONG_FOLDED_COUNT;
  const matches = filteredSongs();
  const visible = matches.slice(0, visibleSongCount);
  els.songResultMeta.textContent = `${matches.length.toLocaleString("ja-JP")}曲中${visible.length.toLocaleString("ja-JP")}曲を表示`;
  els.songEmpty.hidden = matches.length !== 0;
  els.songExpand.hidden = visible.length >= matches.length;
  els.songExpand.textContent = `すべて表示（残り${Math.max(matches.length - visible.length, 0).toLocaleString("ja-JP")}曲）`;
  els.songExpand.setAttribute("aria-expanded", String(visible.length >= matches.length));
  els.songCollapse.hidden = visibleSongCount <= SONG_FOLDED_COUNT;
  els.songGrid.innerHTML = visible.map(song => `
    <article class="song-card">
      <a class="song-thumbnail" href="${escapeHTML(song.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(song.title)}を公式YouTubeで聴く">
        <img src="${thumbnailUrl(song.videoId)}" alt="${escapeHTML(song.title)}の掲載動画のサムネイル" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="480" height="360">
      </a>
      <div class="song-card-top">
        <span class="video-channel ${song.channel}">${song.channel === "island" ? "ISLAND" : "TOWER"}</span>
        <span class="song-note">♪</span>
      </div>
      <h3>${escapeHTML(song.title)}</h3>
      ${song.titleType === "descriptive" ? `<p class="song-title-kind">整理名（公式動画タイトルから）</p>` : ""}
      ${(song.aliases || []).length ? `<p class="song-performer">別名（動画タイトル）：${escapeHTML(song.aliases.join("、"))}</p>` : ""}
      <p class="song-performer">歌う人物：${escapeHTML(song.performer)}</p>
      <p>${escapeHTML(song.summary)}</p>
      <div class="tag-list">${(song.tags || []).map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("")}</div>
      <a class="button song-link" href="${escapeHTML(song.url)}" target="_blank" rel="noopener noreferrer">公式動画で聴く ↗</a>
    </article>
  `).join("");

  els.songGrid.querySelectorAll(".song-thumbnail img").forEach(image => {
    image.addEventListener("error", () => image.closest(".song-thumbnail")?.classList.add("is-unavailable"), { once: true });
  });
}

function filteredVideos() {
  const query = normalize(els.videoSearch.value);
  const matches = videos.filter(video => {
    const haystack = normalize([
      video.title,
      video.description,
      ...(video.topics || []),
      ...(video.entities || []).flatMap(entity => [entity.name, ...(entity.aliases || []), entity.label]),
      ...(video.facts || []).flatMap(fact => [fact.label, fact.value])
    ].join(" "));
    const matchesQuery = !query || haystack.includes(query);
    const matchesChannel = activeVideoChannel === "all" || video.channel === activeVideoChannel;
    const matchesTopic = activeTopic === "all" || video.topics.includes(activeTopic);
    return matchesQuery && matchesChannel && matchesTopic;
  });

  return matches.sort((a, b) => {
    if (els.videoSort.value === "oldest") return String(a.publishedAt).localeCompare(String(b.publishedAt));
    if (els.videoSort.value === "title") return a.title.localeCompare(b.title, "ja");
    return String(b.publishedAt).localeCompare(String(a.publishedAt));
  });
}

function renderVideoInfo(video) {
  const people = (video.entities || []).filter(entity => entity.entityType === "character");
  const groups = (video.entities || []).filter(entity => entity.entityType === "group");
  const facts = video.facts || [];
  if (!people.length && !groups.length && !facts.length) return "";
  return `<div class="video-verified-info">
    <p>動画内の人物・設定</p>
    <dl>
      ${people.length ? `<div><dt>人物・キャラ</dt><dd>${people.map(entity => `<button type="button" data-open="${escapeHTML(entity.id)}">${escapeHTML(entity.name)}</button>`).join("")}</dd></div>` : ""}
      ${groups.length ? `<div><dt>コンビ・ユニット</dt><dd>${groups.map(entity => `<button type="button" data-open="${escapeHTML(entity.id)}">${escapeHTML(entity.name)}</button>`).join("")}</dd></div>` : ""}
      ${facts.length ? `<div><dt>確認できた情報</dt><dd>${facts.map(fact => `<a href="${escapeHTML(fact.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHTML(fact.label)}</strong>：${escapeHTML(fact.value)}</a>`).join("")}</dd></div>` : ""}
    </dl>
    <small>公式タイトルまたは確認済みの動画内容から掲載</small>
  </div>`;
}

function formatDate(value) {
  if (!value) return "公開日不明";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function renderTopicFilters() {
  els.topicFilters.innerHTML = [
    `<button class="topic-chip is-active" type="button" data-topic="all">すべて</button>`,
    ...videoTopics.filter(topic => topic.count > 0).map(topic => `<button class="topic-chip" type="button" data-topic="${escapeHTML(topic.name)}">${escapeHTML(topic.name)} <span>${topic.count.toLocaleString("ja-JP")}</span></button>`)
  ].join("");
}

function renderVideos({ reset = false } = {}) {
  if (reset) visibleVideoCount = 24;
  const matches = filteredVideos();
  const visible = matches.slice(0, visibleVideoCount);
  els.videoResultMeta.textContent = `${matches.length.toLocaleString("ja-JP")}本が該当・${visible.length.toLocaleString("ja-JP")}本を表示中`;
  els.videoEmpty.hidden = matches.length !== 0;
  els.videoLoadMore.hidden = visible.length >= matches.length;
  els.videoGrid.innerHTML = visible.map(video => `
    <article class="video-card">
      <a class="video-thumbnail" href="${escapeHTML(video.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(video.title)}を公式YouTubeで見る">
        <img src="${thumbnailUrl(video.id)}" alt="${escapeHTML(video.title)}のYouTubeサムネイル" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="480" height="360">
        <span aria-hidden="true">▶</span>
      </a>
      <div class="video-card-meta">
        <span class="video-channel ${video.channel}">${video.channel === "island" ? "ISLAND" : "TOWER"}</span>
        <time datetime="${escapeHTML(video.publishedAt || "")}">${escapeHTML(formatDate(video.publishedAt))}</time>
      </div>
      <h3>${escapeHTML(video.title)}</h3>
      ${video.description ? `<details class="video-description"><summary>YouTube説明欄を見る</summary><p>${escapeHTML(video.description)}</p></details>` : ""}
      ${renderVideoInfo(video)}
      <div class="video-topic-list">${video.topics.length ? video.topics.map(topic => `<button type="button" data-topic-jump="${escapeHTML(topic)}">#${escapeHTML(topic)}</button>`).join("") : `<span>#その他</span>`}</div>
      <a href="${escapeHTML(video.url)}" target="_blank" rel="noopener noreferrer">公式YouTubeで見る ↗</a>
    </article>
  `).join("");

  els.videoGrid.querySelectorAll(".video-thumbnail img").forEach(image => {
    image.addEventListener("error", () => image.closest(".video-thumbnail")?.classList.add("is-unavailable"), { once: true });
  });
}

function updateVideoFilters() {
  document.querySelectorAll("[data-video-channel]").forEach(item => item.classList.toggle("is-active", item.dataset.videoChannel === activeVideoChannel));
  document.querySelectorAll("[data-topic]").forEach(item => item.classList.toggle("is-active", item.dataset.topic === activeTopic));
  renderVideos({ reset: true });
}

document.addEventListener("click", event => {
  const favorite = event.target.closest("[data-favorite]");
  if (favorite) {
    event.stopPropagation();
    const id = favorite.dataset.favorite;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    localStorage.setItem("yatsu-favorites", JSON.stringify([...favorites]));
    render();
    return;
  }
  const open = event.target.closest("[data-open]");
  if (open) openCharacter(open.dataset.open);
});

els.search.addEventListener("input", () => render({ reset: true }));
els.songSearch.addEventListener("input", () => renderSongs({ reset: true }));
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("is-active", item === button));
  render({ reset: true });
}));
document.querySelector("#randomButton").addEventListener("click", openRandom);
document.querySelector("#randomHero").addEventListener("click", openRandom);
document.querySelector("#dialogClose").addEventListener("click", () => els.dialog.close());
els.dialog.addEventListener("click", event => { if (event.target === els.dialog) els.dialog.close(); });
document.querySelector("#resetFilters").addEventListener("click", () => {
  els.search.value = "";
  activeFilter = "all";
  document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("is-active", item.dataset.filter === "all"));
  render({ reset: true });
});
els.characterExpand.addEventListener("click", () => {
  visibleCharacterCount = filteredCharacters().length;
  render();
});
els.characterCollapse.addEventListener("click", () => {
  visibleCharacterCount = CHARACTER_FOLDED_COUNT;
  render();
  document.querySelector("#catalog-title").scrollIntoView({ behavior: "smooth", block: "start" });
});
els.songExpand.addEventListener("click", () => {
  visibleSongCount = filteredSongs().length;
  renderSongs();
});
els.songCollapse.addEventListener("click", () => {
  visibleSongCount = SONG_FOLDED_COUNT;
  renderSongs();
  document.querySelector("#song-title").scrollIntoView({ behavior: "smooth", block: "start" });
});

els.videoSearch.addEventListener("input", () => renderVideos({ reset: true }));
els.videoSort.addEventListener("change", () => renderVideos({ reset: true }));
document.querySelectorAll("[data-video-channel]").forEach(button => button.addEventListener("click", () => {
  activeVideoChannel = button.dataset.videoChannel;
  updateVideoFilters();
}));
els.topicFilters.addEventListener("click", event => {
  const topic = event.target.closest("[data-topic]");
  if (!topic) return;
  activeTopic = topic.dataset.topic;
  updateVideoFilters();
});
els.videoGrid.addEventListener("click", event => {
  const topic = event.target.closest("[data-topic-jump]");
  if (!topic) return;
  activeTopic = topic.dataset.topicJump;
  updateVideoFilters();
  els.topicFilters.scrollIntoView({ behavior: "smooth", block: "center" });
});
els.videoLoadMore.addEventListener("click", () => {
  visibleVideoCount += 24;
  renderVideos();
});

async function init() {
  try {
    const [catalogResponse, videosResponse, songsResponse] = await Promise.all([
      fetch("data/catalog.json", { cache: "no-cache" }),
      fetch("data/videos.json", { cache: "no-cache" }),
      fetch("data/songs.json", { cache: "no-cache" })
    ]);
    if (!catalogResponse.ok) throw new Error(`catalog ${catalogResponse.status}`);
    if (!videosResponse.ok) throw new Error(`videos ${videosResponse.status}`);
    if (!songsResponse.ok) throw new Error(`songs ${songsResponse.status}`);
    const [data, videoData, songData] = await Promise.all([catalogResponse.json(), videosResponse.json(), songsResponse.json()]);
    characters = [
      ...data.characters.map(character => ({ ...character, entityType: "character" })),
      ...data.groups.map(group => ({ ...group, entityType: "group" }))
    ];
    videos = videoData.videos;
    videoTopics = videoData.topics;
    songs = songData.songs;
    els.videoTotal.textContent = videoData.total.toLocaleString("ja-JP");
    els.songTotal.textContent = songData.total.toLocaleString("ja-JP");
    renderTopicFilters();
    render();
    renderSongs();
    renderVideos();
    updateMobileNav();
  } catch (error) {
    console.error("図鑑データの読み込みに失敗しました", error);
    els.count.textContent = "0";
    els.empty.hidden = false;
    els.empty.querySelector("strong").textContent = "図鑑データを読み込めませんでした";
    els.videoResultMeta.textContent = "動画データを読み込めませんでした";
    els.songResultMeta.textContent = "楽曲データを読み込めませんでした";
  }
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
init();
