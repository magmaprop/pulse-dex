import { create } from "zustand";
import type {
  Market,
  Position,
  Order,
  OrderBook,
  Trade,
  AccountInfo,
  Pool,
  StakingInfo,
  LeaderboardEntry,
  UserPoints,
  PriceFeed,
} from "@/types";
import { MARKETS_CONFIG } from "@/config/markets";

// ─── Market Store ──────────────────────────────────────────────
interface MarketStore {
  markets: Market[];
  selectedMarket: Market | null;
  setSelectedMarket: (market: Market) => void;
  updateMarketPrice: (symbol: string, price: number) => void;
  updateMarketPrices: (prices: Record<string, PriceFeed>) => void;
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  markets: MARKETS_CONFIG.map((m) => ({
    ...m,
    price: 0,
    change24h: 0,
    volume24h: 0,
    openInterest: 0,
    fundingRate: 0,
    nextFunding: Date.now() + 3600000,
  })),
  selectedMarket: null,

  setSelectedMarket: (market) => set({ selectedMarket: market }),

  updateMarketPrice: (symbol, price) =>
    set((state) => ({
      markets: state.markets.map((m) =>
        m.symbol === symbol ? { ...m, price } : m
      ),
      selectedMarket:
        state.selectedMarket?.symbol === symbol
          ? { ...state.selectedMarket, price }
          : state.selectedMarket,
    })),

  updateMarketPrices: (prices) =>
    set((state) => {
      const updated = state.markets.map((m) => {
        const feed = prices[m.symbol];
        if (feed) {
          const oldPrice = m.price;
          const change = oldPrice > 0 ? ((feed.price - oldPrice) / oldPrice) * 100 : 0;
          return { ...m, price: feed.price, change24h: change || m.change24h };
        }
        return m;
      });

      const selectedFeed = state.selectedMarket
        ? prices[state.selectedMarket.symbol]
        : null;

      return {
        markets: updated,
        selectedMarket: state.selectedMarket && selectedFeed
          ? { ...state.selectedMarket, price: selectedFeed.price }
          : state.selectedMarket
            ? updated.find((m) => m.symbol === state.selectedMarket!.symbol) || state.selectedMarket
            : null,
      };
    }),
}));

// ─── Account Store ─────────────────────────────────────────────
interface AccountStore {
  account: AccountInfo | null;
  isConnected: boolean;
  positions: Position[];
  openOrders: Order[];
  setAccount: (account: AccountInfo | null) => void;
  setConnected: (connected: boolean) => void;
  setPositions: (positions: Position[]) => void;
  setOpenOrders: (orders: Order[]) => void;
  addPosition: (position: Position) => void;
  removePosition: (id: string) => void;
  addOrder: (order: Order) => void;
  removeOrder: (id: string) => void;
}

export const useAccountStore = create<AccountStore>((set) => ({
  account: null,
  isConnected: false,
  positions: [],
  openOrders: [],

  setAccount: (account) => set({ account }),
  setConnected: (isConnected) => set({ isConnected }),
  setPositions: (positions) => set({ positions }),
  setOpenOrders: (openOrders) => set({ openOrders }),

  addPosition: (position) =>
    set((state) => ({ positions: [...state.positions, position] })),
  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),
  addOrder: (order) =>
    set((state) => ({ openOrders: [...state.openOrders, order] })),
  removeOrder: (id) =>
    set((state) => ({
      openOrders: state.openOrders.filter((o) => o.id !== id),
    })),
}));

// ─── Order Book Store ──────────────────────────────────────────
interface OrderBookStore {
  orderbook: OrderBook;
  recentTrades: Trade[];
  setOrderBook: (ob: OrderBook) => void;
  addTrade: (trade: Trade) => void;
  setRecentTrades: (trades: Trade[]) => void;
}

export const useOrderBookStore = create<OrderBookStore>((set) => ({
  orderbook: {
    asks: [],
    bids: [],
    spread: 0,
    spreadPercentage: 0,
    lastUpdateId: 0,
  },
  recentTrades: [],

  setOrderBook: (orderbook) => set({ orderbook }),
  addTrade: (trade) =>
    set((state) => ({
      recentTrades: [trade, ...state.recentTrades.slice(0, 99)],
    })),
  setRecentTrades: (recentTrades) => set({ recentTrades }),
}));

// ─── UI Store ──────────────────────────────────────────────────
type Page = "trade" | "portfolio" | "earn" | "leaderboard";

interface UIStore {
  currentPage: Page;
  depositModalOpen: boolean;
  withdrawModalOpen: boolean;
  settingsOpen: boolean;
  setCurrentPage: (page: Page) => void;
  setDepositModalOpen: (open: boolean) => void;
  setWithdrawModalOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentPage: "trade",
  depositModalOpen: false,
  withdrawModalOpen: false,
  settingsOpen: false,

  setCurrentPage: (currentPage) => set({ currentPage }),
  setDepositModalOpen: (depositModalOpen) => set({ depositModalOpen }),
  setWithdrawModalOpen: (withdrawModalOpen) => set({ withdrawModalOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));

// ─── Earn Store ────────────────────────────────────────────────
interface EarnStore {
  pools: Pool[];
  staking: StakingInfo | null;
  setPools: (pools: Pool[]) => void;
  setStaking: (staking: StakingInfo) => void;
}

export const useEarnStore = create<EarnStore>((set) => ({
  pools: [],
  staking: null,
  setPools: (pools) => set({ pools }),
  setStaking: (staking) => set({ staking }),
}));

// ─── Leaderboard Store ─────────────────────────────────────────
interface LeaderboardStore {
  entries: LeaderboardEntry[];
  userPoints: UserPoints | null;
  currentSeason: number;
  setEntries: (entries: LeaderboardEntry[]) => void;
  setUserPoints: (points: UserPoints) => void;
  setCurrentSeason: (season: number) => void;
}

export const useLeaderboardStore = create<LeaderboardStore>((set) => ({
  entries: [],
  userPoints: null,
  currentSeason: 3,
  setEntries: (entries) => set({ entries }),
  setUserPoints: (userPoints) => set({ userPoints }),
  setCurrentSeason: (currentSeason) => set({ currentSeason }),
}));
