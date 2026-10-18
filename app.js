let characters = [];
let videos = [];
let videoTopics = [];

const els = {
  grid: document.querySelector("#characterGrid"),
  search: document.querySelector("#searchInput"),
  count: document.querySelector("#resultCount"),
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
  topicFilters: document.querySelector("#topicFilters")
};

let activeFilter = "all";
let activeVideoChannel = "all";
let activeTopic = "all";
let visibleVideoCount = 24;
let favorites = new Set(JSON.parse(localStorage.getItem("yatsu-favorites") || "[]"));

const normalize = value => value.toLowerCase().normalize("NFKC").replace(/\s/g, "");
const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

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

function render() {
  const matches = filteredCharacters();
  els.count.textContent = matches.length;
  els.empty.hidden = matches.length !== 0;
  els.grid.innerHTML = matches.map(character => `
    <article class="character-card" style="--card-color:${character.color};--accent:${character.channel === "island" ? "#ff6b35" : "#2f66ef"}">
      <div class="card-top">
        <span class="channel-badge">${escapeHTML(character.channelLabel)}</span>
        <button class="favorite-button" type="button" data-favorite="${character.id}" aria-label="${escapeHTML(character.name)}をお気に入り${favorites.has(character.id) ? "から外す" : "に追加"}" aria-pressed="${favorites.has(character.id)}">${favorites.has(character.id) ? "★" : "☆"}</button>
      </div>
      <div class="character-symbol" aria-hidden="true">${escapeHTML(character.symbol)}</div>
      <h3>${escapeHTML(character.name)}</h3>
      <p>${escapeHTML(character.summary)}</p>
      <div class="tag-list">${character.tags.slice(0, 3).map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("")}</div>
      <button class="card-open" type="button" data-open="${character.id}" aria-label="${escapeHTML(character.name)}の詳細を見る">詳細を見る</button>
    </article>
  `).join("");
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

function filteredVideos() {
  const query = normalize(els.videoSearch.value);
  const matches = videos.filter(video => {
    const haystack = normalize([video.title, ...(video.topics || [])].join(" "));
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
      <div class="video-card-meta">
        <span class="video-channel ${video.channel}">${video.channel === "island" ? "ISLAND" : "TOWER"}</span>
        <time datetime="${escapeHTML(video.publishedAt || "")}">${escapeHTML(formatDate(video.publishedAt))}</time>
      </div>
      <h3>${escapeHTML(video.title)}</h3>
      <div class="video-topic-list">${video.topics.length ? video.topics.map(topic => `<button type="button" data-topic-jump="${escapeHTML(topic)}">#${escapeHTML(topic)}</button>`).join("") : `<span>#その他</span>`}</div>
      <a href="${escapeHTML(video.url)}" target="_blank" rel="noopener noreferrer">公式YouTubeで見る ↗</a>
    </article>
  `).join("");
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

els.search.addEventListener("input", render);
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("is-active", item === button));
  render();
}));
document.querySelector("#randomButton").addEventListener("click", openRandom);
document.querySelector("#randomHero").addEventListener("click", openRandom);
document.querySelector("#dialogClose").addEventListener("click", () => els.dialog.close());
els.dialog.addEventListener("click", event => { if (event.target === els.dialog) els.dialog.close(); });
document.querySelector("#resetFilters").addEventListener("click", () => {
  els.search.value = "";
  activeFilter = "all";
  document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("is-active", item.dataset.filter === "all"));
  render();
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
    const [catalogResponse, videosResponse] = await Promise.all([
      fetch("data/catalog.json", { cache: "no-cache" }),
      fetch("data/videos.json", { cache: "no-cache" })
    ]);
    if (!catalogResponse.ok) throw new Error(`catalog ${catalogResponse.status}`);
    if (!videosResponse.ok) throw new Error(`videos ${videosResponse.status}`);
    const [data, videoData] = await Promise.all([catalogResponse.json(), videosResponse.json()]);
    characters = [
      ...data.characters.map(character => ({ ...character, entityType: "character" })),
      ...data.groups.map(group => ({ ...group, entityType: "group" }))
    ];
    videos = videoData.videos;
    videoTopics = videoData.topics;
    els.videoTotal.textContent = videoData.total.toLocaleString("ja-JP");
    renderTopicFilters();
    render();
    renderVideos();
  } catch (error) {
    console.error("図鑑データの読み込みに失敗しました", error);
    els.count.textContent = "0";
    els.empty.hidden = false;
    els.empty.querySelector("strong").textContent = "図鑑データを読み込めませんでした";
    els.videoResultMeta.textContent = "動画データを読み込めませんでした";
  }
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
init();
