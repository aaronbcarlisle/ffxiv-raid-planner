import { MOUNT_FARM_TRIALS, type MountFarmTrial } from './mount-farms';

const JA_DUTY_NAMES: Record<string, string> = {
  'arr-garuda': '極ガルーダ討滅戦',
  'dt-valigarmanda': '極ヴァリガルマンダ討滅戦',
  'dt-zoraal-ja': '極ゾラージャ討滅戦',
  'dt-sphene': '極エターナルクイーン討滅戦',
  'dt-recollection': '極ゼレニア討滅戦',
  'dt-necron-embrace': '極永遠の闇討滅戦',
  'dt-windward-wilds': '極護竜アルシュベルド狩猟戦',
  'dt-hell-on-rails': '極グラシャラボラス討滅戦',
  'dt-unmaking': '極エヌオー討滅戦',
  'ew-zodiark': '極ゾディアーク討滅戦',
  'ew-hydaelyn': '極ハイデリン討滅戦',
  'ew-endsinger': '終極の戦い',
  'ew-barbariccia': '極バルバリシア討滅戦',
  'ew-rubicante': '極ルビカンテ討滅戦',
  'ew-golbez': '極ゴルベーザ討滅戦',
  'ew-zeromus': '極ゼロムス討滅戦',
  'shb-titania': '極ティターニア討滅戦',
  'shb-innocence': '極イノセンス討滅戦',
  'shb-hades': '極ハーデス討滅戦',
  'shb-warrior-of-light': '極ウォーリア・オブ・ライト討滅戦',
  'shb-emerald': '極エメラルドウェポン破壊作戦',
  'shb-diamond': '極ダイヤウェポン捕獲作戦',
  'sb-susano': '極スサノオ討滅戦',
  'sb-lakshmi': '極ラクシュミ討滅戦',
  'sb-shinryu': '神龍討滅戦',
  'sb-byakko': '極白虎征魂戦',
  'sb-tsukuyomi': '極ツクヨミ討滅戦',
  'sb-suzaku': '極朱雀征魂戦',
  'sb-seiryu': '極青龍征魂戦',
  'hw-bismarck': '極ビスマルク討滅戦',
  'hw-ravana': '極ラーヴァナ討滅戦',
  'hw-thordan': '蒼天幻想 ナイツ・オブ・ラウンド討滅戦',
  'hw-sephirot': '極セフィロト討滅戦',
  'hw-nidhogg': '蒼天幻想 ニーズヘッグ征竜戦',
  'hw-sophia': '極ソフィア討滅戦',
  'hw-zurvan': '極ズルワーン討滅戦',
  'ult-ucob': '絶バハムート討滅戦',
  'ult-uwu': '絶アルテマウェポン破壊作戦',
  'ult-tea': '絶アレキサンダー討滅戦',
  'ult-dsr': '絶竜詩戦争',
  'ult-top': '絶オメガ検証戦',
  'ult-fru': '絶もうひとつの未来',
  'ult-dmu': '絶妖星乱舞',
  'arr-titan': '極タイタン討滅戦',
  'arr-ifrit': '極イフリート討滅戦',
  'arr-leviathan': '極リヴァイアサン討滅戦',
  'arr-ramuh': '極ラムウ討滅戦',
  'arr-shiva': '極シヴァ討滅戦',
};

const JA_REWARD_NAMES: Record<string, string> = {
  // A Realm Reborn
  'arr-garuda': 'クサントス',
  'arr-titan': 'グルファクシ',
  'arr-ifrit': 'アイトン',
  'arr-leviathan': 'エンバル',
  'arr-ramuh': 'マルカブ',
  'arr-shiva': 'ボレアス',
  // Heavensward — Lanner birds
  'hw-bismarck': 'ホワイトランナー',
  'hw-ravana': 'ローズランナー',
  'hw-thordan': 'ラウンドランナー',
  'hw-sephirot': 'ウォーリングランナー',
  'hw-nidhogg': 'ダークランナー',
  'hw-sophia': 'ソフィアランナー',
  'hw-zurvan': 'デモニックランナー',
  // Stormblood — Kamuy mounts
  'sb-susano': '神輿カムイ',
  'sb-lakshmi': '至福のカムイ',
  'sb-shinryu': '神龍',
  'sb-byakko': '瑞獣カムイ',
  'sb-tsukuyomi': '月光のカムイ',
  'sb-suzaku': '歓楽のカムイ',
  'sb-seiryu': '神話のカムイ',
  // Shadowbringers
  'shb-titania': 'ティターニア',
  'shb-innocence': 'イノセンス',
  'shb-hades': 'ハーデス',
  'shb-warrior-of-light': 'ウォーリア・オブ・ライト',
  'shb-emerald': 'エメラルドグイヴル',
  'shb-diamond': 'ダイヤモンドグイヴル',
  // Endwalker — Lynx mounts
  'ew-zodiark': '堕ちし影のリンクス',
  'ew-hydaelyn': '神聖なる光のリンクス',
  'ew-endsinger': '永劫の闇のリンクス',
  'ew-barbariccia': '帝国の哀惜のリンクス',
  'ew-rubicante': '奈落の悲嘆のリンクス',
  'ew-golbez': '義なる炎のリンクス',
  'ew-zeromus': '威風のリンクス',
  // Dawntrail
  'dt-valigarmanda': 'ウィング・オブ・ルーイン',
  'dt-zoraal-ja': 'ウィング・オブ・リゾルヴ',
  'dt-sphene': 'ウィング・オブ・エターナル',
  'dt-recollection': 'ウィング・オブ・ナイトフッド',
  'dt-necron-embrace': 'ウィング・オブ・デス',
  'dt-windward-wilds': 'ネコ荷車',
  'dt-hell-on-rails': 'ウィング・オブ・ミスト',
  'dt-unmaking': 'ウィング・オブ・ニヒリティ',
  // Ultimate weapons
  'ult-ucob': 'バハ絶武器',
  'ult-uwu': 'アルテマ武器',
  'ult-tea': 'アレキ絶武器',
  'ult-dsr': '竜詩武器',
  'ult-top': 'オメガ武器',
  'ult-fru': 'エデンモーン【絶】武器',
  'ult-dmu': 'パラッツォダイヤ武器',
};

const JA_ORCHESTRION_NAMES: Record<string, string> = {
  // Dawntrail
  'dt-valigarmanda-orch': 'ザ・スカイルーイン',
  'dt-zoraal-ja-orch': 'シーキング・パーパス',
  'dt-sphene-orch': 'ペイヴド・イン・ソリチュード',
  'dt-recollection-orch': 'ローズ・オブ・メイ〔黄金〕',
  'dt-necron-orch': 'ファイナルファンタジーIX ザ・ファイナルバトル〔黄金〕',
  'dt-hell-on-rails-orch': 'ファイナルファンタジーIX バトル2〔黄金〕',
  'dt-unmaking-orch': 'ファイナルファンタジーV ザ・ファイナルバトル〔黄金〕',
  // Endwalker
  'ew-zodiark-orch': 'エンドコーラー',
  'ew-hydaelyn-orch': 'ユア・アンサー',
  'ew-endsinger-orch': 'ザ・ファイナルデイ',
  'ew-barbariccia-orch': '四天王とのバトル〔暁月〕',
  'ew-rubicante-orch': 'フォージド・イン・クリムゾン',
  'ew-golbez-orch': 'ヴォイドキャスト・セイヴァー',
  'ew-zeromus-orch': 'ファイナルファンタジーIV ザ・ファイナルバトル〔暁月〕',
  // Shadowbringers
  'shb-titania-orch': 'ホワット・エンジェル・ウェイクス・ミー',
  'shb-innocence-orch': 'インサニティ',
  'shb-hades-orch-1': 'シャドウブリンガーズ',
  'shb-hades-orch-2': 'インヴィンシブル',
  'shb-wol-orch': 'トゥ・ザ・エッジ',
  'shb-emerald-orch': 'ザ・ブラック・ウルフ・ストークス・アゲイン',
  'shb-diamond-orch': 'イン・ザ・アームズ・オブ・ウォー',
  // Stormblood
  'sb-susano-orch': 'リヴェレーション',
  'sb-lakshmi-orch': 'ビューティーズ・ウィキッド・ワイルズ',
  'sb-shinryu-orch-1': 'ザ・ワームズ・ヘッド',
  'sb-shinryu-orch-2': 'ザ・ワームズ・テイル',
  'sb-byakko-orch': 'ザ・ジェイド・ストア',
  'sb-tsukuyomi-orch': 'アンダー・ザ・ムーンライト',
  'sb-suzaku-orch': 'サンライズ',
  'sb-seiryu-orch': 'フロム・ザ・ドラゴンズ・ウェイク',
  // Heavensward
  'hw-bismarck-orch-1': 'リミットレス・ブルー',
  'hw-bismarck-orch-2': 'ウー・ザット・イズ・マッドネス',
  'hw-ravana-orch-1': 'ザ・ハンド・ザット・ギブス・ザ・ローズ',
  'hw-ravana-orch-2': 'アンベンディング・スティール',
  'hw-thordan-orch': 'ヒーローズ',
  'hw-sephirot-orch': 'フィーンド',
  'hw-nidhogg-orch': 'リヴェンジ・オブ・ザ・ホード',
  'hw-sophia-orch': 'エクイリブリウム',
  'hw-zurvan-orch': 'インフィニティ',
};

const JA_EXPANSION_NAMES: Record<string, string> = {
  'DT': '黄金のレガシー',
  'EW': '暁月のフィナーレ',
  'ShB': '漆黒のヴィランズ',
  'SB': '紅蓮のリベレーター',
  'HW': '蒼天のイシュガルド',
  'ARR': '新生エオルゼア',
};

function isJapaneseLocale(locale?: string): boolean {
  return (locale ?? '').toLowerCase().startsWith('ja');
}

export function resolveUiLocale(language?: string): string {
  return isJapaneseLocale(language) ? 'ja-JP' : 'en-US';
}

const JA_DUTY_NAMES_BY_EN = new Map(
  MOUNT_FARM_TRIALS.map((trial) => [trial.dutyName, JA_DUTY_NAMES[trial.id] ?? trial.dutyName]),
);

const JA_REWARD_NAMES_BY_EN = new Map(
  MOUNT_FARM_TRIALS.map((trial) => [trial.rewardName ?? trial.mountName, JA_REWARD_NAMES[trial.id] ?? trial.rewardName ?? trial.mountName]),
);

export function getLocalizedDutyName(
  sourceDutyKey: string | null | undefined,
  fallback: string,
  locale?: string,
): string {
  if (!isJapaneseLocale(locale)) {
    return fallback;
  }
  return (sourceDutyKey ? JA_DUTY_NAMES[sourceDutyKey] : null) ?? JA_DUTY_NAMES_BY_EN.get(fallback) ?? fallback;
}

export function getLocalizedRewardName(
  sourceDutyKey: string | null | undefined,
  fallback: string,
  locale?: string,
): string {
  if (!isJapaneseLocale(locale)) {
    return fallback;
  }
  return (sourceDutyKey ? JA_REWARD_NAMES[sourceDutyKey] : null) ?? JA_REWARD_NAMES_BY_EN.get(fallback) ?? fallback;
}

export function getLocalizedDutyNameByText(
  fallback: string | null | undefined,
  locale?: string,
): string {
  if (!fallback) {
    return '';
  }
  if (!isJapaneseLocale(locale)) {
    return fallback;
  }
  return JA_DUTY_NAMES_BY_EN.get(fallback) ?? fallback;
}

export function getLocalizedRewardNameByText(
  fallback: string | null | undefined,
  locale?: string,
): string {
  if (!fallback) {
    return '';
  }
  if (!isJapaneseLocale(locale)) {
    return fallback;
  }
  return JA_REWARD_NAMES_BY_EN.get(fallback) ?? fallback;
}

export function getLocalizedTrialDutyName(trial: MountFarmTrial | null | undefined, locale?: string): string {
  if (!trial) {
    return '';
  }
  return getLocalizedDutyName(trial.id, trial.dutyName, locale);
}

export function getLocalizedTrialRewardName(trial: MountFarmTrial | null | undefined, locale?: string): string {
  if (!trial) {
    return '';
  }
  return getLocalizedRewardName(trial.id, trial.rewardName ?? trial.mountName, locale);
}

export function getLocalizedCatalogItemName(
  item: {
    category?: string | null;
    name: string;
    sourceDutyKey?: string | null;
    externalId?: string | null;
  },
  locale?: string,
): string {
  if (!isJapaneseLocale(locale)) return item.name;
  if ((item.category === 'mount' || item.category === 'weapon') && item.sourceDutyKey) {
    return getLocalizedRewardName(item.sourceDutyKey, item.name, locale);
  }
  if (item.category === 'orchestrion' && item.externalId) {
    return JA_ORCHESTRION_NAMES[item.externalId] ?? item.name;
  }
  return item.name;
}

export function getLocalizedExpansionName(expansionId: string, locale?: string): string {
  if (!isJapaneseLocale(locale)) return expansionId;
  return JA_EXPANSION_NAMES[expansionId] ?? expansionId;
}
