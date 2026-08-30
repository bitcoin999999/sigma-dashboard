import type { SigmaStatus } from "@/lib/types";

export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];

/** Where the reader's choice is kept between visits. */
export const LANG_STORAGE_KEY = "sigma-guide-lang";

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "ko";
}

interface Step {
  title: string;
  body: string;
}

interface Misconception {
  wrong: string;
  right: string;
}

interface QuestionAnswer {
  q: string;
  a: string;
}

interface SurfaceCopy {
  name: string;
  body: string;
}

interface StatusCopy {
  longLabel: string;
  description: string;
}

/**
 * Every word on the guide page, in both languages.
 *
 * The board itself stays English — the status labels a reader meets on a card
 * are `OVERHEATED` and `NORMAL` whatever language they read the guide in, so
 * only the long label and the explanation are translated.
 *
 * Anything interpolated from live or case-study figures is a function rather
 * than a template with placeholders: Korean puts the number in a different
 * place in the sentence, and a `{0}` scheme would hide that.
 */
export interface GuideCopy {
  /** Label on the button that switches *to* this language. */
  switchLabel: string;
  switchAria: string;
  eyebrow: string;
  title: string;
  intro: string;

  band: {
    inside: string;
    anchorTick: string;
    ariaLabel: string;
    below: string;
    within: string;
    above: string;
  };

  mechanics: {
    eyebrow: string;
    title: string;
    description: string;
    steps: Step[];
    exampleLabel: string;
    example: string;
  };

  reading: {
    eyebrow: string;
    title: string;
    description: string;
    status: Record<SigmaStatus, StatusCopy>;
  };

  limits: {
    eyebrow: string;
    title: string;
    description: string;
    items: Misconception[];
  };

  confluence: {
    eyebrow: string;
    title: string;
    description: string;
    inputsTitle: string;
    sigmaTerm: string;
    sigmaBody: string;
    gexTerm: string;
    gexBody: string;
    inputsNote: string;
    rulesTitle: string;
    rules: string[];
    rulesNote: string;
  };

  caseStudy: {
    eyebrow: (symbol: string) => string;
    title: string;
    description: (name: string, window: string, gap: string) => string;
    bandWindow: string;
    anchorLabel: (date: string) => string;
    widthLabel: string;
    lowerEdgeLabel: string;
    gammaStrikeLabel: (gap: string) => string;
    shareLabel: string;
    shareValue: (share: number, dominance: number) => string;
    monday: {
      day: string;
      meta: string;
      body: (close: string, z: string) => string;
    };
    tuesday: {
      day: string;
      meta: (percent: string) => string;
      body: (high: string) => string;
    };
    friday: {
      day: string;
      meta: string;
      body: (close: string, z: string) => string;
    };
    honestLabel: string;
    honest: (symbol: string, asOf: string, count: number) => string;
  };

  workflow: {
    eyebrow: string;
    title: string;
    description: string;
    steps: string[];
  };

  reference: {
    eyebrow: string;
    title: string;
    description: string;
    /** Keyed by the route each card links to. */
    surfaces: Record<string, SurfaceCopy>;
  };

  faq: {
    eyebrow: string;
    title: string;
    items: QuestionAnswer[];
  };

  cta: {
    window: (bandWindow: string) => string;
    /** Takes the anchor day alone — the language supplies the word "close". */
    anchor: (anchorDay: string) => string;
    open: string;
  };

  chart: {
    anchor: string;
    lowerEdge: string;
    gex: string;
    /** Axis labels, keyed by the weekday code in `CASE.sessions`. */
    days: Record<string, string>;
    ariaLabel: (symbol: string, window: string) => string;
  };
}

const en: GuideCopy = {
  switchLabel: "English",
  switchAria: "Read this guide in English",
  eyebrow: "Guide",
  title: "Where the market sits inside its own range",
  intro:
    "1SIGMA does not tell you whether a stock is cheap. It tells you how much of the move its own options were priced for has already happened — and that is a different question, with a different use.",

  band: {
    inside: "≈ 68% of expected outcomes",
    anchorTick: "Anchor",
    ariaLabel:
      "The expected-range scale, running from below −1.5 sigma through the anchor close to above +1.5 sigma.",
    below: "Further down than the week was priced for",
    within: "Inside the range the options market paid for",
    above: "Further up than the week was priced for",
  },

  mechanics: {
    eyebrow: "Mechanics",
    title: "How the band is built",
    description:
      "Three inputs, one of which changes every week and two of which do not move at all once the week starts.",
    steps: [
      {
        title: "The anchor",
        body: "Friday's regular-session close. It is fixed for the whole week — the band does not roll forward, and Wednesday is measured against the same price Monday was.",
      },
      {
        title: "The width",
        body: "The 1σ move the options market prices for the week ahead, as a percentage of the anchor. It comes from implied volatility, not from past returns, so it widens before an earnings week on its own.",
      },
      {
        title: "The reading",
        body: "Distance from the anchor divided by that width. One number, on the same scale for every symbol, which is what makes a $9 name and a $900 name comparable at all.",
      },
    ],
    exampleLabel: "Worked example",
    example:
      "A stock closes Friday at $200 and its options price a ±5% week. That makes the anchor $200, the lower edge $190 and the upper edge $210. Then $205 reads +0.50σ, $210 reads +1.00σ and lands on the above-1σ list, and $185 reads −1.50σ and is called oversold. The same arithmetic runs on every symbol, which is why one board can hold both a $9 stock and a $900 one.",
  },

  reading: {
    eyebrow: "Reading",
    title: "What each reading is called",
    description:
      "Five states, and the board never uses any others. The thresholds are the same ones the upstream weekly alert scores against.",
    status: {
      OVERHEATED: {
        longLabel: "Above +1.5σ",
        description:
          "More than 1.5 standard deviations above the anchor close. Statistically stretched to the upside.",
      },
      UPPER_1SIGMA: {
        longLabel: "Above +1σ",
        description:
          "Broke the upper 1σ edge of its expected range but has not reached the overheated threshold.",
      },
      NORMAL: {
        longLabel: "Within ±1σ",
        description: "Inside the expected range. No statistical dislocation.",
      },
      LOWER_1SIGMA: {
        longLabel: "Below −1σ",
        description:
          "Broke the lower 1σ edge of its expected range but has not reached the oversold threshold.",
      },
      OVERSOLD: {
        longLabel: "Below −1.5σ",
        description:
          "More than 1.5 standard deviations below the anchor close. Statistically stretched to the downside.",
      },
    },
  },

  limits: {
    eyebrow: "Limits",
    title: "What a reading does not say",
    description:
      "The most expensive way to use this board is to read a band edge as an instruction.",
    items: [
      {
        wrong: "−1σ means buy",
        right:
          "It means the fall is already larger than the week was priced for. That happens because something changed, and the something is usually still true tomorrow.",
      },
      {
        wrong: "+1σ means sell",
        right:
          "Strong trends spend whole weeks outside the upper edge. A band tells you the move is unusual, not that it is finished.",
      },
      {
        wrong: "A wide band means bullish",
        right:
          "Width is a statement about range, not direction. A ±12% band says the options market expects a big week either way.",
      },
      {
        wrong: "The band reacts to news",
        right:
          "It is struck once, on Friday. An earnings miss on Tuesday does not widen it — which is exactly why a reading can run to −2σ and keep going.",
      },
    ],
  },

  confluence: {
    eyebrow: "Confluence",
    title: "1SIGMA × dealer gamma",
    description:
      "The one screen on this site that does not come from the band alone — and the reason a level here is worth more than a round number.",
    inputsTitle: "Two different inputs",
    sigmaTerm: "−1σ",
    sigmaBody:
      "Comes from implied volatility: what the options market paid for range this week. It is a statement about how far price was expected to travel.",
    gexTerm: "Positive GEX",
    gexBody:
      "Comes from open interest: a strike where dealers are long enough gamma that hedging it means buying into weakness. It is a statement about where flow concentrates.",
    inputsNote:
      "Neither is derived from the other. When they land on the same price, the level is corroborated rather than restated — which is the only reason the screen exists.",
    rulesTitle: "What the screen actually requires",
    rules: [
      "The strongest positive-GEX strike below spot. A secondary strike that happens to line up is a coincidence, not a level.",
      "Within half a percent of the −1σ edge — at typical strike spacing, usually one strike wide.",
      "At least 15% of the positive gamma sitting near spot, and at least twice the next-strongest strike. A strike can clear one of those on its own and still be noise.",
    ],
    rulesNote:
      "Call the result a reaction zone, not support. Gamma is a position, and positions change — the level can be gone by Thursday.",
  },

  caseStudy: {
    eyebrow: (symbol) => `Case study · ${symbol}`,
    title: "When the two levels agreed",
    description: (name, window, gap) =>
      `${name}, band window ${window}. The −1σ edge and the week's dominant gamma strike landed ${gap}% apart — close enough that on a chart they are one line.`,
    bandWindow: "Aug 24 – Aug 28, 2026",
    anchorLabel: (date) => `Anchor · Fri ${date}`,
    widthLabel: "1σ for the week",
    lowerEdgeLabel: "−1σ edge",
    gammaStrikeLabel: (gap) => `Gamma strike · ${gap}`,
    shareLabel: "Share of nearby gamma",
    shareValue: (share, dominance) => `${share}% · ${dominance}× next`,
    monday: {
      day: "Monday",
      meta: "through both levels",
      body: (close, z) =>
        `The week opened six percent below the anchor and kept going. The low printed under the gamma strike inside the first hour — and was the only print of the week below it. The close came back to ${close}, ${z}. On a daily candle the level held.`,
    },
    tuesday: {
      day: "Tuesday",
      meta: (percent) => `+${percent}% off Monday's low`,
      body: (high) =>
        `The session traded up to ${high} before giving back more than half of it. That is the whole case for watching a confluence zone: not that it predicted a bottom, but that the reaction when price reached it was large enough to be worth being early for.`,
    },
    friday: {
      day: "Friday",
      meta: "tested again",
      body: (close, z) =>
        `Price came back to the same shelf four sessions later, stopped five dollars above the strike, and closed the week at ${close} — ${z}, inside the band. Twice tested, twice held on a closing basis.`,
    },
    honestLabel: "The honest part",
    honest: (symbol, asOf, count) =>
      `The screen only looks at strikes near spot, so it did not name ${symbol} until the ${asOf} board — after Monday's test, not before it. The gamma was already there on Monday's settlement, and it was the largest positive-gamma strike anywhere below spot, but price had not yet come close enough for the screen to see it. That is the shape of the tool: it narrows a board of ${count} names down to the few worth watching, and it does not time anything. Had the week gone the other way, the same two lines would have broken and this would be an example in the section above.`,
  },

  workflow: {
    eyebrow: "Workflow",
    title: "A way to read the board",
    description:
      "Top down, and never starting with the individual name — a symbol at −1σ means something different on a day when forty others are too.",
    steps: [
      "Start with the benchmarks. Where SPY, QQQ and SOXX sit tells you whether a single name has moved or the whole tape has.",
      "Read the sector map. One sector stretched while the rest sit at their anchors is a different story from a board that moved together.",
      "Open the ±1σ lists. These are the names whose week has already exceeded what their own options were priced for.",
      "Check the gamma floors. A −1σ edge with a dominant positive-GEX strike on it is two independent levels agreeing on a price.",
      "Confirm somewhere else. Volume, the news, the options flow, the chart — the board tells you where to look, not what happened.",
      "Decide. A level is a place to watch price react, not an instruction to act when it is touched.",
    ],
  },

  reference: {
    eyebrow: "Reference",
    title: "What each list is for",
    description:
      "Every page reads the same snapshot and the same band. They differ only in what they select.",
    surfaces: {
      "/": {
        name: "Sigma monitor",
        body: "Every tracked symbol with its live reading, grouped by sector when no filter is applied.",
      },
      "/screener/above-1-sigma": {
        name: "Trading above +1σ",
        body: "Names that have left the upper edge of their own weekly range.",
      },
      "/screener/below-1-sigma": {
        name: "Trading below −1σ",
        body: "The same on the downside — the list the gamma-floor screen draws from.",
      },
      "/screener/gex-floor-at-1-sigma": {
        name: "GEX floor at −1σ",
        body: "Where a dominant dealer-gamma strike lands on the −1σ edge. The one screen that combines two independent inputs.",
      },
      "/screener/highest-implied-move": {
        name: "Widest expected move",
        body: "Where the options market is paying for the most room this week. A range statement, never a direction.",
      },
      "/my-sigma": {
        name: "My Sigma",
        body: "Your own names only, scored on the same band as everything else.",
      },
    },
  },

  faq: {
    eyebrow: "FAQ",
    title: "Questions this board keeps raising",
    items: [
      {
        q: "Why is every symbol at 0.00σ before Monday?",
        a: "Because the band was just struck. Friday's close becomes the new anchor, so until the market trades again every symbol sits exactly on it by construction. On that day the board is showing the range for the week ahead, not a result.",
      },
      {
        q: "Where does the 1σ number come from?",
        a: "From the option-implied move for the week ahead, published by Unusual Whales and converted upstream into a true 1σ. Nothing on this site derives a band from past price movement.",
      },
      {
        q: "Why is this range wider than the expected move I see elsewhere?",
        a: "Most feeds quote the at-the-money straddle scaled by about 0.85, which is roughly a 0.68σ move — the range price stays inside about half the time. A 1σ range is the one price stays inside about 68% of the time, so it is about 1.47 times wider. It is a unit conversion, not a safety margin.",
      },
      {
        q: "What is a GEX floor?",
        a: "A strike below spot where dealers hold enough positive gamma that hedging it means buying into weakness. It is derived from open interest, not from implied volatility, which is why a gamma strike landing on the −1σ edge counts as corroboration rather than the same number said twice.",
      },
      {
        q: "Does a reading past ±1σ mean the move is over?",
        a: "No. It means the move is bigger than the week was priced for. A σ reading measures how unusual a move is; it says nothing about what comes next.",
      },
      {
        q: "How often does the board update?",
        a: "Prices refresh through the session. The band itself is struck once a week from Friday's close and stays fixed until the next one.",
      },
      {
        q: "Is this investment advice?",
        a: "No. Everything here is a measurement of published market data, offered as a way to decide what deserves a closer look.",
      },
    ],
  },

  cta: {
    window: (bandWindow) => `Band window ${bandWindow}`,
    anchor: (anchorDay) => `Anchored on the ${anchorDay} close.`,
    open: "Open the board",
  },

  chart: {
    anchor: "Anchor",
    lowerEdge: "−1σ",
    gex: "GEX",
    days: { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri" },
    ariaLabel: (symbol, window) =>
      `${symbol} daily candles for ${window}. Monday traded down through both the −1σ edge and the gamma strike and closed back above them; Tuesday rebounded more than ten percent off that low.`,
  },
};

const ko: GuideCopy = {
  switchLabel: "한국어",
  switchAria: "이 가이드를 한국어로 보기",
  eyebrow: "가이드",
  title: "지금 주가, 예상 범위의 어디쯤일까요?",
  intro:
    "1SIGMA는 어떤 종목이 싼지 알려주지 않아요. 대신 그 종목의 옵션이 이번 주에 예상해둔 움직임 중에서 얼마나 지나갔는지를 알려줘요. 싸다·비싸다와는 다른 질문이라, 쓰는 방법도 달라요.",

  band: {
    inside: "≈ 10번 중 7번은 이 안",
    anchorTick: "앵커",
    ariaLabel:
      "−1.5σ 아래에서 앵커 종가를 지나 +1.5σ 위까지 이어지는 예상 범위 눈금이에요.",
    below: "이번 주 예상보다 더 내려온 구간",
    within: "옵션시장이 값을 치른 범위 안",
    above: "이번 주 예상보다 더 올라간 구간",
  },

  mechanics: {
    eyebrow: "구조",
    title: "밴드는 이렇게 만들어져요",
    description:
      "필요한 건 딱 세 가지예요. 하나는 매주 바뀌고, 나머지 둘은 한 주가 시작되면 꿈쩍도 안 해요.",
    steps: [
      {
        title: "앵커",
        body: "금요일 정규장 종가예요. 한 주 내내 그대로 고정돼요. 밴드가 매일 따라 움직이지 않아서, 수요일에도 월요일과 똑같은 가격을 기준으로 재요.",
      },
      {
        title: "폭",
        body: "옵션시장이 다음 한 주 움직임을 얼마로 봤는지, 앵커 대비 퍼센트로 나타낸 값이에요. 과거 주가가 아니라 지금 옵션 가격에서 나오기 때문에, 실적 발표가 있는 주에는 알아서 넓어져요.",
      },
      {
        title: "수치",
        body: "앵커에서 얼마나 떨어졌는지를 그 폭으로 나눈 숫자예요. 모든 종목을 같은 자로 재는 거라, 9달러짜리와 900달러짜리를 나란히 놓고 볼 수 있어요.",
      },
    ],
    exampleLabel: "이렇게 계산해요",
    example:
      "어떤 종목이 금요일에 $200로 마감했고, 옵션시장은 이번 주 움직임을 ±5%로 봤다고 해볼게요. 그럼 앵커는 $200, 하단은 $190, 상단은 $210이에요. 여기서 주가가 $205면 +0.50σ, $210이면 +1.00σ라서 '+1σ 위' 목록에 올라가요. $185까지 내려가면 −1.50σ, 과매도 구간이고요. 모든 종목에 똑같은 산수를 쓰기 때문에 9달러짜리와 900달러짜리가 한 보드에 같이 있을 수 있어요.",
  },

  reading: {
    eyebrow: "읽는 법",
    title: "구간마다 이름이 있어요",
    description:
      "상태는 다섯 개가 전부예요. 보드는 이 다섯 개 말고 다른 이름을 쓰지 않아요. 기준선은 주간 알림에서 채점할 때 쓰는 것과 똑같고요.",
    status: {
      OVERHEATED: {
        longLabel: "+1.5σ 위",
        description:
          "앵커 종가보다 1.5 표준편차 넘게 올라간 상태예요. 통계적으로 위쪽으로 많이 늘어난 거예요.",
      },
      UPPER_1SIGMA: {
        longLabel: "+1σ 위",
        description:
          "예상 범위의 위쪽 끝은 넘었지만, 과열 기준까지는 안 간 상태예요.",
      },
      NORMAL: {
        longLabel: "±1σ 이내",
        description: "예상 범위 안에 있어요. 특별히 벗어난 게 없어요.",
      },
      LOWER_1SIGMA: {
        longLabel: "−1σ 아래",
        description:
          "예상 범위의 아래쪽 끝은 넘었지만, 과매도 기준까지는 안 간 상태예요.",
      },
      OVERSOLD: {
        longLabel: "−1.5σ 아래",
        description:
          "앵커 종가보다 1.5 표준편차 넘게 내려간 상태예요. 통계적으로 아래쪽으로 많이 늘어난 거예요.",
      },
    },
  },

  limits: {
    eyebrow: "한계",
    title: "이 숫자가 말해주지 않는 것",
    description:
      "이 보드를 가장 비싸게 쓰는 방법은, 밴드 끝을 '사라·팔아라'로 읽는 거예요.",
    items: [
      {
        wrong: "−1σ면 사야 해요",
        right:
          "이번 주 예상보다 더 많이 빠졌다는 뜻일 뿐이에요. 그렇게 될 만한 이유가 있었을 거고, 그 이유는 내일도 대체로 그대로예요.",
      },
      {
        wrong: "+1σ면 팔아야 해요",
        right:
          "강한 추세는 몇 주씩 위쪽 밖에서 놀아요. 밴드는 '이 움직임이 흔치 않다'고 말할 뿐, '이제 끝났다'고는 말하지 않아요.",
      },
      {
        wrong: "밴드가 넓으면 강세예요",
        right:
          "폭은 방향이 아니라 범위 이야기예요. ±12% 밴드는 옵션시장이 '어느 쪽으로든 크게 움직일 주'로 봤다는 뜻이에요.",
      },
      {
        wrong: "밴드는 뉴스에 반응해요",
        right:
          "밴드는 금요일에 한 번 긋고 끝이에요. 화요일에 실적 쇼크가 나도 밴드가 넓어지지는 않아요. 수치가 −2σ까지 갔다가 거기서 더 갈 수 있는 이유가 바로 이거예요.",
      },
    ],
  },

  confluence: {
    eyebrow: "겹칠 때",
    title: "1SIGMA × 딜러 감마",
    description:
      "이 사이트에서 밴드만으로 만들어지지 않는 유일한 스크린이에요. 여기서 나온 가격대가 그냥 라운드 넘버보다 값어치 있는 이유이기도 하고요.",
    inputsTitle: "출처가 다른 두 숫자",
    sigmaTerm: "−1σ",
    sigmaBody:
      "내재변동성에서 나와요. 이번 주 범위에 옵션시장이 치른 값이고, '가격이 얼마나 멀리 갈까'에 대한 답이에요.",
    gexTerm: "양(+)의 GEX",
    gexBody:
      "미결제약정에서 나와요. 딜러가 감마를 길게 들고 있어서, 헤지하려면 오히려 하락을 사야 하는 행사가예요. '물량이 어디 몰려 있나'에 대한 답이고요.",
    inputsNote:
      "둘은 서로에게서 나온 숫자가 아니에요. 그래서 같은 가격에 겹치면 같은 말을 두 번 한 게 아니라 서로를 받쳐준 거예요. 이 스크린이 있는 이유는 이거 하나예요.",
    rulesTitle: "스크린이 요구하는 조건",
    rules: [
      "현재가 아래에서 양의 GEX가 가장 강한 행사가여야 해요. 어쩌다 줄이 맞은 2순위 행사가는 가격대가 아니라 우연이에요.",
      "−1σ 끝에서 0.5% 안쪽이어야 해요. 보통 행사가 간격으로는 한 칸 정도예요.",
      "현재가 근처 양의 감마 중 최소 15%가 그 행사가에 있고, 차순위보다 2배 이상 커야 해요. 둘 중 하나만 넘겨서는 아직 노이즈일 수 있어요.",
    ],
    rulesNote:
      "결과는 '지지선'이 아니라 '반응 구간'으로 읽어주세요. 감마는 결국 포지션이고, 포지션은 바뀌어요. 목요일엔 그 가격대가 사라져 있을 수도 있어요.",
  },

  caseStudy: {
    eyebrow: (symbol) => `사례 · ${symbol}`,
    title: "두 가격대가 겹쳤던 주",
    description: (name, window, gap) =>
      `${name}의 밴드 구간은 ${window}이었어요. −1σ 끝과 그 주에 감마가 가장 몰린 행사가가 ${gap}%밖에 안 떨어져 있었어요. 차트에서는 거의 한 줄로 보일 정도예요.`,
    bandWindow: "2026년 8월 24–28일",
    anchorLabel: (date) => `앵커 · 금 ${date}`,
    widthLabel: "이번 주 1σ",
    lowerEdgeLabel: "−1σ 끝",
    gammaStrikeLabel: (gap) => `감마 행사가 · ${gap}`,
    shareLabel: "근처 감마 비중",
    shareValue: (share, dominance) => `${share}% · 차순위의 ${dominance}배`,
    monday: {
      day: "월요일",
      meta: "두 가격대 모두 뚫림",
      body: (close, z) =>
        `그 주는 앵커보다 6% 아래에서 열렸고 계속 내려갔어요. 장 시작 한 시간 안에 감마 행사가 아래로 저점을 찍었는데, 그 주에 그 아래를 찍은 건 이때 딱 한 번이었어요. 종가는 ${close}, ${z}로 다시 올라왔고요. 일봉으로 보면 그 가격대는 지켜진 셈이에요.`,
    },
    tuesday: {
      day: "화요일",
      meta: (percent) => `월요일 저점 대비 +${percent}%`,
      body: (high) =>
        `이날은 ${high}까지 올랐다가 절반 넘게 반납했어요. 겹치는 구간을 지켜볼 이유는 이게 다예요. 바닥을 정확히 맞혀서가 아니라, 가격이 그 지점에 닿았을 때 반응이 미리 가 있을 만큼 컸다는 거예요.`,
    },
    friday: {
      day: "금요일",
      meta: "다시 시험",
      body: (close, z) =>
        `네 세션 뒤에 가격은 같은 자리로 돌아와 행사가보다 5달러 위에서 멈췄고, 그 주를 ${close} — ${z}, 밴드 안쪽에서 마감했어요. 두 번 시험받고 두 번 다 종가 기준으로는 지켜냈어요.`,
    },
    honestLabel: "솔직히 말하면",
    // 티커 뒤에 조사를 붙이지 않는다 — 을/를은 마지막 글자 받침에 따라 갈리는데
    // 심볼은 런타임 값이라 어느 쪽이 맞는지 미리 알 수 없다.
    honest: (symbol, asOf, count) =>
      `이 스크린은 현재가 근처 행사가만 보기 때문에, ${asOf} 보드에 와서야 ${symbol} 이름이 떴어요. 월요일의 시험 전이 아니라 후였죠. 감마는 월요일 정산분에 이미 거기 있었고 현재가 아래에서 가장 큰 양의 감마 행사가였지만, 주가가 스크린 눈에 들어올 만큼 가까이 오지 않았을 뿐이에요. 이 도구는 원래 이렇게 생겼어요. ${count}개 종목을 지켜볼 만한 몇 개로 좁혀줄 뿐, 타이밍까지 잡아주지는 않아요. 그 주가 반대로 흘렀다면 같은 두 줄이 그대로 뚫렸을 거고, 이 사례는 위의 '한계'에 들어갔을 거예요.`,
  },

  workflow: {
    eyebrow: "순서",
    title: "보드는 이 순서로 보세요",
    description:
      "위에서 아래로요. 개별 종목부터 보지 마세요. 마흔 종목이 함께 −1σ인 날의 −1σ는 의미가 달라요.",
    steps: [
      "벤치마크부터 봐요. SPY·QQQ·SOXX가 어디 있는지를 보면 한 종목이 움직인 건지 시장 전체가 움직인 건지 알 수 있어요.",
      "섹터 맵을 읽어요. 다른 데는 앵커에 붙어 있는데 한 섹터만 늘어난 것과, 보드 전체가 같이 움직인 건 완전히 다른 이야기예요.",
      "±1σ 목록을 열어요. 자기 옵션이 예상한 것보다 이번 주에 이미 더 나가버린 종목들이에요.",
      "감마 바닥을 확인해요. −1σ 끝에 가장 강한 양의 GEX 행사가가 놓여 있다면, 서로 상관없는 두 숫자가 같은 가격에서 만난 거예요.",
      "다른 데서 한 번 더 확인해요. 거래량, 뉴스, 옵션 플로, 차트요. 보드는 어디를 볼지만 알려주지, 무슨 일이 있었는지는 안 알려줘요.",
      "그다음에 판단해요. 가격대는 반응을 지켜볼 자리이지, 닿는 순간 뭘 하라는 신호가 아니에요.",
    ],
  },

  reference: {
    eyebrow: "메뉴 안내",
    title: "각 목록은 이럴 때 봐요",
    description:
      "모든 페이지가 같은 스냅샷, 같은 밴드를 읽어요. 다른 건 무엇을 골라내느냐뿐이에요.",
    // 이름은 영어 그대로 둔다 — 보드 UI 자체가 영어라, 번역해두면 독자가 화면에서
    // 찾을 라벨과 달라진다. 설명만 옮긴다.
    surfaces: {
      "/": {
        name: "Sigma monitor",
        body: "추적 중인 모든 종목의 실시간 수치예요. 필터를 안 걸면 섹터별로 묶여요.",
      },
      "/screener/above-1-sigma": {
        name: "Trading above +1σ",
        body: "자기 주간 범위의 위쪽을 벗어난 종목들이에요.",
      },
      "/screener/below-1-sigma": {
        name: "Trading below −1σ",
        body: "반대로 아래쪽을 벗어난 종목들이에요. 감마 바닥 스크린이 재료로 쓰는 목록이기도 해요.",
      },
      "/screener/gex-floor-at-1-sigma": {
        name: "GEX floor at −1σ",
        body: "가장 강한 딜러 감마 행사가가 −1σ 끝에 놓인 경우예요. 서로 다른 두 숫자를 합치는 유일한 스크린이에요.",
      },
      "/screener/highest-implied-move": {
        name: "Widest expected move",
        body: "이번 주 옵션시장이 가장 넓은 공간에 값을 치른 곳이에요. 범위 이야기지 방향 이야기는 절대 아니에요.",
      },
      "/my-sigma": {
        name: "My Sigma",
        body: "내 종목만 모아서, 다른 데와 똑같은 밴드로 채점해 보여줘요.",
      },
    },
  },

  faq: {
    eyebrow: "FAQ",
    title: "자주 나오는 질문",
    items: [
      {
        q: "월요일 전에는 왜 전부 0.00σ인가요?",
        a: "밴드를 방금 그었기 때문이에요. 금요일 종가가 새 앵커가 되니까, 시장이 다시 열리기 전까지는 모든 종목이 정확히 그 위에 있을 수밖에 없어요. 이때 보드가 보여주는 건 결과가 아니라 다가올 한 주의 범위예요.",
      },
      {
        q: "1σ 숫자는 어디서 오나요?",
        a: "Unusual Whales가 내놓는 다음 한 주 옵션 예상 변동폭을, 상위 단계에서 진짜 1σ로 바꾼 값이에요. 이 사이트의 어떤 밴드도 과거 주가 움직임에서 뽑아내지 않아요.",
      },
      {
        q: "다른 데서 본 예상 변동폭보다 범위가 넓은데요?",
        a: "대부분의 피드는 등가격 스트래들에 0.85 정도를 곱해서 써요. 그건 대략 0.68σ 움직임이라, 주가가 그 안에 머무는 비율이 절반쯤인 범위예요. 1σ 범위는 약 68% 확률로 머무는 범위라 1.47배쯤 넓고요. 여유를 더 준 게 아니라 단위가 다른 거예요.",
      },
      {
        q: "GEX 바닥이 뭔가요?",
        a: "현재가 아래에서 딜러가 양의 감마를 충분히 들고 있어서, 헤지하려면 오히려 하락을 사야 하는 행사가예요. 내재변동성이 아니라 미결제약정에서 나오기 때문에, 이게 −1σ 끝에 놓이면 같은 숫자를 두 번 말한 게 아니라 서로 확인해준 걸로 봐요.",
      },
      {
        q: "±1σ를 넘으면 움직임이 끝난 건가요?",
        a: "아니에요. 이번 주 예상보다 크게 움직였다는 뜻이에요. σ는 그 움직임이 얼마나 흔치 않은지를 재는 숫자일 뿐, 다음에 뭐가 올지는 아무 말도 하지 않아요.",
      },
      {
        q: "얼마나 자주 갱신되나요?",
        a: "가격은 장중 내내 갱신돼요. 밴드 자체는 금요일 종가로 주 1회 긋고, 다음 주까지 그대로예요.",
      },
      {
        q: "이거 투자 조언인가요?",
        a: "아니에요. 여기 있는 건 전부 공개된 시장 데이터를 측정한 결과예요. 무엇을 더 들여다볼지 정할 때 쓰는 재료로 봐주세요.",
      },
    ],
  },

  cta: {
    window: (bandWindow) => `밴드 구간 ${bandWindow}`,
    anchor: (anchorDay) => `${anchorDay} 종가 기준이에요.`,
    open: "보드 열기",
  },

  chart: {
    anchor: "앵커",
    lowerEdge: "−1σ",
    gex: "GEX",
    days: { Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금" },
    ariaLabel: (symbol, window) =>
      `${window} 기간의 ${symbol} 일봉이에요. 월요일엔 −1σ 끝과 감마 행사가를 모두 뚫고 내려갔다가 그 위로 올라와 마감했고, 화요일엔 그 저점에서 10% 넘게 반등했어요.`,
  },
};

export const GUIDE_COPY: Record<Lang, GuideCopy> = { en, ko };
