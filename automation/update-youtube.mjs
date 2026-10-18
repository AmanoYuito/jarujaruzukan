import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const VIDEOS_PATH = new URL("data/videos.json", ROOT);
const CATALOG_PATH = new URL("data/catalog.json", ROOT);
const CANDIDATES_PATH = new URL("data/automation-candidates.json", ROOT);

const CHANNELS = [
  { id: "tower", name: "ジャルジャルタワー", youtubeChannelId: "UChwgNUWPM-ksOP3BbfQHS5Q" },
  { id: "island", name: "ジャルジャルアイランド", youtubeChannelId: "UCf-wG6PlxW7rpixx1tmODJw" }
];

const TOWER_ALLOWED_TITLE = /(?:^ジャルジャルコント[『「]|ジャルジャルのネタのタネ|本気ネタ|煩悩ネタ|[0-9０-９一二三四五六七八九十百千万億]+億回(?:再生)?記念)/;
const TOPICS = [
  { name: "面接", keywords: ["面接", "就活", "採用"] },
  { name: "電話", keywords: ["電話", "もしもし", "コールセンター"] },
  { name: "オーディション", keywords: ["オーディション", "審査員"] },
  { name: "バイト", keywords: ["バイト", "アルバイト"] },
  { name: "会社・仕事", keywords: ["会社", "社員", "上司", "部下", "社長", "職場", "出勤", "仕事"] },
  { name: "学校", keywords: ["学校", "先生", "生徒", "教師", "授業", "部活", "高校", "大学"] },
  { name: "友達", keywords: ["友達", "親友", "知り合い", "同級生"] },
  { name: "恋愛・結婚", keywords: ["彼女", "彼氏", "恋愛", "結婚", "告白", "カップル", "デート"] },
  { name: "店・接客", keywords: ["店員", "店長", "客", "注文", "レジ", "接客", "ショップ"] },
  { name: "医療", keywords: ["医者", "医師", "病院", "患者", "診察", "手術", "看護"] },
  { name: "芸人・ネタ", keywords: ["芸人", "漫才", "コント", "相方", "ツッコミ", "ボケ", "お笑い"] },
  { name: "音楽", keywords: ["歌", "歌手", "ライブ", "バンド", "ミュージシャン", "曲", "ギター"] },
  { name: "家族", keywords: ["家族", "父", "母", "息子", "娘", "兄弟", "姉", "妹", "親"] },
  { name: "食べ物", keywords: ["食べ", "飲む", "料理", "ご飯", "メシ", "ピザ", "ラーメン", "寿司"] },
  { name: "スポーツ", keywords: ["スポーツ", "試合", "選手", "サッカー", "野球", "バレー", "柔道", "相撲", "コーチ"] },
  { name: "美容・髪", keywords: ["美容", "美容師", "髪", "散髪", "脱毛", "角刈り", "ハゲ"] }
];

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const normalize = value => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\s\u3000"'“”‘’「」『』【】〈〉《》〔〕（）()・！!？?、。,.／/\-―ー〜～:：]/g, "");

function isAllowedVideo(video) {
  return video.channel !== "tower" || TOWER_ALLOWED_TITLE.test(String(video.title).normalize("NFKC"));
}

function topicsFor(title, description = "") {
  const text = `${title} ${description}`.normalize("NFKC").toLowerCase();
  return TOPICS.filter(topic => topic.keywords.some(keyword => text.includes(keyword.normalize("NFKC").toLowerCase()))).map(topic => topic.name);
}

function descriptionExcerpt(description) {
  const skip = /^(?:https?:\/\/|#|▼|▽|■|◆|チャンネル登録|公式(?:サイト|SNS)|twitter|x：|instagram|tiktok|facebook)/i;
  const lines = String(description || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim())
    .filter(line => line && !skip.test(line));
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
}

function entityMatchSource(entity, title, description) {
  const normalizedTitle = normalize(title);
  const normalizedDescription = normalize(description);
  const names = [entity.name, ...(entity.aliases || [])].map(normalize).filter(Boolean);
  if (names.some(name => normalizedTitle.includes(name))) return "official_title";
  if (names.some(name => name.length >= 4 && normalizedDescription.includes(name))) return "official_description";
  return "";
}

function mergeEntities(existing, catalogEntities, title, description) {
  const merged = [...(existing || [])];
  for (const entity of catalogEntities) {
    const source = entityMatchSource(entity, title, description);
    if (!source || merged.some(item => item.id === entity.id && item.entityType === entity.entityType)) continue;
    merged.push({
      id: entity.id,
      name: entity.name,
      aliases: entity.aliases || [],
      entityType: entity.entityType,
      label: entity.entityType === "group" ? "コンビ名" : "キャラ名",
      source
    });
  }
  return merged;
}

function groupCandidates(video, knownGroups) {
  const knownNames = new Set(knownGroups.flatMap(group => [group.name, ...(group.aliases || [])]).map(normalize));
  const text = `${video.title}\n${video.rawDescription || ""}`;
  const patterns = [
    /[「『]([^」』\n]{2,30})[」』](?:っていう|という|って)コンビ/g,
    /コンビ名(?:は|が|：|:)?\s*[「『]?([^」』\n、。]{2,30})[」』]?/g,
    /(?:お笑い|漫才)コンビ[「『]([^」』\n]{2,30})[」』]/g
  ];
  const results = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1].replace(/\s+/g, " ").trim();
      if (!name || knownNames.has(normalize(name)) || /https?|チャンネル|ジャルジャル/i.test(name)) continue;
      results.push({
        id: createHash("sha256").update(`${video.id}:${name}`).digest("hex").slice(0, 16),
        type: "group_name",
        name,
        videoId: video.id,
        videoTitle: video.title,
        url: video.url,
        channel: video.channel,
        source: "official_title_or_description",
        status: "pending_review"
      });
    }
  }
  return results;
}

async function youtubeApi(resource, params, apiKey) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  for (const [key, value] of Object.entries({ ...params, key: apiKey })) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `YouTube API ${response.status}`);
  return body;
}

async function uploadsPlaylistId(channel, apiKey) {
  const result = await youtubeApi("channels", { part: "contentDetails", id: channel.youtubeChannelId }, apiKey);
  const playlistId = result.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error(`${channel.name}のアップロード一覧が見つかりません。`);
  return playlistId;
}

async function recentUploads(channel, knownIds, apiKey) {
  const playlistId = await uploadsPlaylistId(channel, apiKey);
  const videos = [];
  let pageToken = "";
  let pageCount = 0;
  do {
    const page = await youtubeApi("playlistItems", {
      part: "snippet,contentDetails,status",
      playlistId,
      maxResults: "50",
      pageToken
    }, apiKey);
    const pageVideos = (page.items || []).flatMap(item => {
      const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      if (!id || item.status?.privacyStatus === "private") return [];
      return [{
        id,
        title: item.snippet?.title || "",
        rawDescription: item.snippet?.description || "",
        channel: channel.id,
        publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null,
        url: `https://www.youtube.com/watch?v=${id}`
      }];
    });
    videos.push(...pageVideos);
    pageCount += 1;
    if (pageVideos.length && pageVideos.every(video => knownIds.has(video.id))) break;
    pageToken = page.nextPageToken || "";
  } while (pageToken && pageCount < 3);
  return videos;
}

function selfTest() {
  const group = { id: "group-test", name: "一目散", aliases: [], entityType: "group" };
  if (!isAllowedVideo({ channel: "tower", title: "ジャルジャルのネタのタネ『テスト』" })) throw new Error("対象動画の判定に失敗");
  if (isAllowedVideo({ channel: "tower", title: "ジャルジャルコント会議 ロボット三等兵登場！" })) throw new Error("対象外動画の判定に失敗");
  if (entityMatchSource(group, "一目散っていうコンビ", "") !== "official_title") throw new Error("コンビ名の照合に失敗");
  if (!descriptionExcerpt("動画の説明です。\nhttps://example.com\n#お知らせ").includes("動画の説明")) throw new Error("説明欄の整理に失敗");
  console.log("自動更新スクリプトのセルフテストに成功しました。");
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) throw new Error("GitHub ActionsのSecret『YOUTUBE_API_KEY』が未設定です。キーをソースへ直接書かないでください。");

const [videoData, catalog] = await Promise.all([readJson(VIDEOS_PATH), readJson(CATALOG_PATH)]);
let candidateData = { generatedAt: null, candidates: [] };
try {
  candidateData = await readJson(CANDIDATES_PATH);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const knownIds = new Set(videoData.videos.map(video => video.id));
const catalogEntities = [
  ...(catalog.characters || []).map(item => ({ ...item, entityType: "character" })),
  ...(catalog.groups || []).map(item => ({ ...item, entityType: "group" }))
];
const existingById = new Map(videoData.videos.map(video => [video.id, video]));
const fetched = [];
for (const channel of CHANNELS) fetched.push(...await recentUploads(channel, knownIds, apiKey));

let changed = false;
let added = 0;
let enriched = 0;
for (const incoming of fetched.filter(isAllowedVideo)) {
  const previous = existingById.get(incoming.id);
  const description = descriptionExcerpt(incoming.rawDescription);
  const entities = mergeEntities(previous?.entities, catalogEntities, incoming.title, incoming.rawDescription);
  const next = {
    ...(previous || {}),
    id: incoming.id,
    title: incoming.title,
    channel: incoming.channel,
    publishedAt: incoming.publishedAt,
    url: incoming.url,
    topics: topicsFor(incoming.title, description),
    ...(description ? { description, descriptionSource: "youtube_official" } : {}),
    ...(entities.length ? { entities } : {})
  };
  const before = previous ? JSON.stringify(previous) : "";
  if (before !== JSON.stringify(next)) {
    existingById.set(incoming.id, next);
    changed = true;
    previous ? enriched += 1 : added += 1;
  }
}

const knownCandidateIds = new Set((candidateData.candidates || []).map(candidate => candidate.id));
const newCandidates = fetched.flatMap(video => groupCandidates(video, catalog.groups || [])).filter(candidate => !knownCandidateIds.has(candidate.id));
if (newCandidates.length) {
  candidateData = {
    generatedAt: new Date().toISOString(),
    candidates: [...(candidateData.candidates || []), ...newCandidates]
  };
  await writeJson(CANDIDATES_PATH, candidateData);
  changed = true;
}

if (!changed) {
  console.log("新着または更新対象はありませんでした。");
  process.exit(0);
}

const videos = [...existingById.values()].sort((a, b) => String(a.publishedAt || "").localeCompare(String(b.publishedAt || "")) || a.id.localeCompare(b.id));
const topics = TOPICS.map(topic => ({ name: topic.name, count: videos.filter(video => (video.topics || []).includes(topic.name)).length }));
await writeJson(VIDEOS_PATH, { generatedAt: new Date().toISOString(), total: videos.length, topics, videos });
console.log(`更新完了: 新着${added}本、説明・名前の更新${enriched}本、確認待ちコンビ名${newCandidates.length}件`);
