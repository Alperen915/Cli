import { priceService } from './priceService.js';

class SimulatorService {
  constructor() {
    this.strategies = {
      dca: this.simulateDCA.bind(this),
      grid: this.simulateGrid.bind(this),
      momentum: this.simulateMomentum.bind(this),
      meanReversion: this.simulateMeanReversion.bind(this)
    };
  }

  async simulateDCA(params) {
    const {
      symbol = 'ETH',
      totalInvestment = 1000,
      periods = 12,
      periodDays = 30
    } = params;

    const investmentPerPeriod = totalInvestment / periods;
    let totalTokens = 0;
    const purchases = [];

    // Simulate with historical price variations
    const currentPrice = await priceService.getTokenPrice(symbol);
    const basePrice = currentPrice.price;
    
    // Generate simulated historical prices with realistic volatility
    for (let i = 0; i < periods; i++) {
      // Simulate price variation (-30% to +50% from base)
      const volatility = (Math.random() - 0.4) * 0.8;
      const simulatedPrice = basePrice * (1 + volatility);
      const tokensBought = investmentPerPeriod / simulatedPrice;
      totalTokens += tokensBought;

      purchases.push({
        period: i + 1,
        price: simulatedPrice.toFixed(4),
        invested: investmentPerPeriod.toFixed(2),
        tokens: tokensBought.toFixed(6)
      });
    }

    const avgPrice = totalInvestment / totalTokens;
    const currentValue = totalTokens * basePrice;
    const pnl = currentValue - totalInvestment;
    const pnlPercent = (pnl / totalInvestment) * 100;

    return {
      strategy: 'Dollar Cost Averaging (DCA)',
      symbol,
      params: { totalInvestment, periods, periodDays },
      results: {
        totalInvested: totalInvestment.toFixed(2),
        totalTokens: totalTokens.toFixed(6),
        avgBuyPrice: avgPrice.toFixed(4),
        currentPrice: basePrice.toFixed(4),
        currentValue: currentValue.toFixed(2),
        pnl: pnl.toFixed(2),
        pnlPercent: pnlPercent.toFixed(2)
      },
      purchases: purchases.slice(-5), // Last 5 purchases
      analysis: pnl >= 0 
        ? `DCA strategy would have yielded +$${pnl.toFixed(2)} profit (${pnlPercent.toFixed(1)}% return)`
        : `DCA strategy would have resulted in -$${Math.abs(pnl).toFixed(2)} loss (${pnlPercent.toFixed(1)}% return)`
    };
  }

  async simulateGrid(params) {
    const {
      symbol = 'ETH',
      totalInvestment = 1000,
      gridLevels = 10,
      priceRange = 0.2 // 20% above and below current price
    } = params;

    const currentPrice = await priceService.getTokenPrice(symbol);
    const basePrice = currentPrice.price;
    
    const lowerBound = basePrice * (1 - priceRange);
    const upperBound = basePrice * (1 + priceRange);
    const gridSpacing = (upperBound - lowerBound) / gridLevels;
    const investmentPerLevel = totalInvestment / gridLevels;

    const gridLevelsList = [];
    let potentialProfit = 0;

    for (let i = 0; i <= gridLevels; i++) {
      const price = lowerBound + (gridSpacing * i);
      const tokens = investmentPerLevel / price;
      gridLevelsList.push({
        level: i + 1,
        buyPrice: price.toFixed(4),
        sellPrice: (price + gridSpacing).toFixed(4),
        tokens: tokens.toFixed(6),
        profitPerTrade: (tokens * gridSpacing).toFixed(2)
      });
      potentialProfit += tokens * gridSpacing;
    }

    return {
      strategy: 'Grid Trading',
      symbol,
      params: { totalInvestment, gridLevels, priceRange: `${priceRange * 100}%` },
      results: {
        currentPrice: basePrice.toFixed(4),
        lowerBound: lowerBound.toFixed(4),
        upperBound: upperBound.toFixed(4),
        gridSpacing: gridSpacing.toFixed(4),
        investmentPerLevel: investmentPerLevel.toFixed(2),
        potentialProfitPerCycle: potentialProfit.toFixed(2)
      },
      gridLevels: gridLevelsList.slice(0, 5),
      analysis: `Grid strategy with ${gridLevels} levels from $${lowerBound.toFixed(2)} to $${upperBound.toFixed(2)}. Potential profit per full cycle: $${potentialProfit.toFixed(2)}`
    };
  }

  async simulateMomentum(params) {
    const {
      symbol = 'ETH',
      totalInvestment = 1000,
      buyThreshold = 5, // Buy when up 5%
      sellThreshold = -3, // Sell when down 3%
      periods = 30
    } = params;

    const currentPrice = await priceService.getTokenPrice(symbol);
    const basePrice = currentPrice.price;

    let cash = totalInvestment;
    let tokens = 0;
    let trades = [];
    let wins = 0;
    let losses = 0;

    // Simulate momentum trading
    for (let i = 0; i < periods; i++) {
      // Simulate daily price change (-10% to +10%)
      const dailyChange = (Math.random() - 0.5) * 20;
      const simulatedPrice = basePrice * (1 + (Math.random() - 0.5) * 0.4);

      if (dailyChange >= buyThreshold && cash > 0) {
        // Buy signal
        tokens = cash / simulatedPrice;
        trades.push({ type: 'BUY', price: simulatedPrice.toFixed(4), amount: tokens.toFixed(6) });
        cash = 0;
      } else if (dailyChange <= sellThreshold && tokens > 0) {
        // Sell signal
        const saleValue = tokens * simulatedPrice;
        if (saleValue > totalInvestment / trades.length) wins++;
        else losses++;
        cash = saleValue;
        trades.push({ type: 'SELL', price: simulatedPrice.toFixed(4), value: saleValue.toFixed(2) });
        tokens = 0;
      }
    }

    // Final position value
    const finalValue = cash + (tokens * basePrice);
    const pnl = finalValue - totalInvestment;

    return {
      strategy: 'Momentum Trading',
      symbol,
      params: { totalInvestment, buyThreshold: `+${buyThreshold}%`, sellThreshold: `${sellThreshold}%` },
      results: {
        initialInvestment: totalInvestment.toFixed(2),
        finalValue: finalValue.toFixed(2),
        pnl: pnl.toFixed(2),
        pnlPercent: ((pnl / totalInvestment) * 100).toFixed(2),
        totalTrades: trades.length,
        winRate: trades.length > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 'N/A'
      },
      recentTrades: trades.slice(-5),
      analysis: `Momentum strategy with ${buyThreshold}% buy and ${sellThreshold}% sell thresholds. ${pnl >= 0 ? 'Profitable' : 'Loss'} over ${periods} periods.`
    };
  }

  async simulateMeanReversion(params) {
    const {
      symbol = 'ETH',
      totalInvestment = 1000,
      deviationThreshold = 10, // Buy when 10% below average
      periods = 30
    } = params;

    const currentPrice = await priceService.getTokenPrice(symbol);
    const basePrice = currentPrice.price;

    // Simulate mean reversion
    const movingAvg = basePrice;
    const buyPrice = movingAvg * (1 - deviationThreshold / 100);
    const sellPrice = movingAvg * (1 + deviationThreshold / 100);

    const tokensBought = totalInvestment / buyPrice;
    const potentialSaleValue = tokensBought * sellPrice;
    const potentialProfit = potentialSaleValue - totalInvestment;

    return {
      strategy: 'Mean Reversion',
      symbol,
      params: { totalInvestment, deviationThreshold: `${deviationThreshold}%` },
      results: {
        currentPrice: basePrice.toFixed(4),
        movingAverage: movingAvg.toFixed(4),
        buyTriggerPrice: buyPrice.toFixed(4),
        sellTriggerPrice: sellPrice.toFixed(4),
        tokensIfBuy: tokensBought.toFixed(6),
        potentialProfit: potentialProfit.toFixed(2),
        profitPercent: ((potentialProfit / totalInvestment) * 100).toFixed(2)
      },
      analysis: `Buy when ${symbol} drops ${deviationThreshold}% below average ($${buyPrice.toFixed(2)}), sell when ${deviationThreshold}% above ($${sellPrice.toFixed(2)}). Potential profit: $${potentialProfit.toFixed(2)} (${((potentialProfit / totalInvestment) * 100).toFixed(1)}%)`
    };
  }

  async runSimulation(strategyName, params) {
    const strategy = this.strategies[strategyName];
    if (!strategy) {
      return { error: `Unknown strategy: ${strategyName}. Available: ${Object.keys(this.strategies).join(', ')}` };
    }
    return await strategy(params);
  }

  getAvailableStrategies() {
    return [
      { name: 'dca', description: 'Dollar Cost Averaging - Regular periodic investments' },
      { name: 'grid', description: 'Grid Trading - Buy/sell at preset price levels' },
      { name: 'momentum', description: 'Momentum Trading - Follow price trends' },
      { name: 'meanReversion', description: 'Mean Reversion - Trade based on price deviations' }
    ];
  }
}

export const simulatorService = new SimulatorService();
