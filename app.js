let characters = [];

const els = {
  grid: document.querySelector("#characterGrid"),
  search: document.querySelector("#searchInput"),
  count: document.querySelector("#resultCount"),
  empty: document.querySelector("#emptyState"),
  dialog: document.querySelector("#characterDialog"),
  dialogContent: document.querySelector("#dialogContent")
};

let activeFilter = "all";
let favorites = new Set(JSON.parse(localStorage.getItem("yatsu-favorites") || "[]"));

const normalize = value => value.toLowerCase().normalize("NFKC").replace(/\s/g, "");
const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

function filteredCharacters() {
  const query = normalize(els.search.value);
  return characters.filter(character => {
    const haystack = normalize([character.name, character.kana, ...(character.aliases || []), character.summary, ...character.tags].join(" "));
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

async function init() {
  try {
    const response = await fetch("data/catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    const data = await response.json();
    characters = [
      ...data.characters.map(character => ({ ...character, entityType: "character" })),
      ...data.groups.map(group => ({ ...group, entityType: "group" }))
    ];
    render();
  } catch (error) {
    console.error("図鑑データの読み込みに失敗しました", error);
    els.count.textContent = "0";
    els.empty.hidden = false;
    els.empty.querySelector("strong").textContent = "図鑑データを読み込めませんでした";
  }
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
init();
