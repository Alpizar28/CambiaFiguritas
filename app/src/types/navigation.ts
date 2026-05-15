export type RootTabParamList = {
  Album: undefined;
  Matches: undefined;
  Events: undefined;
  Rankings: undefined;
  Profile: undefined;
};

export type MatchesStackParamList = {
  MatchesList: undefined;
  MatchProfile: { uid: string };
};

export type TradeStackParamList = {
  TradeHome: undefined;
  TradeHost: { sessionId?: string };
  TradeJoin: { prefilledCode?: string };
  TradeSelect: { sessionId: string; role: 'host' | 'guest' };
  TradeReview: { sessionId: string; role: 'host' | 'guest' };
  TradeComplete: { sessionId: string };
  TradeShare: undefined;
  TradeGuestWeb: { token: string };
  TradeListCompare: undefined;
};
