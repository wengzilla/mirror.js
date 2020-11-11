import {
  AccAddress,
  MsgExecuteContract,
  Coins,
  MsgInstantiateContract,
  Coin,
  Numeric,
  Dec
} from '@terra-money/terra.js';
import { EmptyObject } from '../utils/EmptyObject';
import { AssetInfo, Asset, isNativeToken } from '../utils/Asset';
import { ContractClient } from './ContractClient';
import { TerraswapToken } from './TerraswapToken';

export namespace TerraswapPair {
  export interface InitHook {
    msg: string;
    contract_addr: AccAddress;
  }

  export interface InitMsg {
    asset_infos: [AssetInfo, AssetInfo];
    token_code_id: number;
    init_hook?: InitHook;
  }

  export interface HandleProvideLiquidity {
    provide_liquidity: {
      assets: [Asset, Asset];
      slippage_tolerance?: string;
    };
  }

  export interface HandleSwap {
    swap: {
      offer_asset: Asset;
      belief_price?: string;
      max_spread?: string;
      to?: AccAddress;
    };
  }

  export interface HookSwap {
    swap: {
      belief_price?: string;
      max_spread?: string;
      to?: AccAddress;
    };
  }

  export interface HookWithdrawLiquidity {
    withdraw_liquidity: EmptyObject;
  }

  export interface QueryPair {
    pair: EmptyObject;
  }

  export interface QueryPool {
    pool: EmptyObject;
  }

  export interface QuerySimulation {
    simulation: {
      offer_asset: Asset;
    };
  }

  export interface QueryReverseSimulation {
    reverse_simulation: {
      ask_asset: Asset;
    };
  }

  export interface PairResponse {
    asset_infos: [AssetInfo, AssetInfo];
    contract_addr: AccAddress;
    liquidity_token: AccAddress;
  }

  export interface PoolResponse {
    assets: [Asset, Asset];
    total_share: string;
  }

  export interface SimulationResponse {
    return_amount: string;
    spread_amount: string;
    commission_amount: string;
  }

  export interface ReverseSimulationResponse {
    offer_amount: string;
    spread_amount: string;
    commission_amount: string;
  }

  export type HandleMsg = HandleProvideLiquidity | HandleSwap;

  export type HookMsg = HookSwap | HookWithdrawLiquidity;

  export type QueryMsg =
    | QueryPair
    | QueryPool
    | QuerySimulation
    | QueryReverseSimulation;
}

function createHookMsg(msg: TerraswapPair.HookMsg): string {
  return Buffer.from(JSON.stringify(msg)).toString('base64');
}

export class TerraswapPair extends ContractClient {
  public init(
    init_msg: TerraswapPair.InitMsg,
    migratable: boolean
  ): MsgInstantiateContract {
    return this.createInstantiateMsg(init_msg, {}, migratable);
  }

  /// CONTRACT - If providing asset is not native token,
  /// must increase allowance first before using it
  public provideLiquidity(assets: [Asset, Asset]): MsgExecuteContract {
    let coins: Coins = new Coins([]);
    assets.forEach((asset) => {
      if (isNativeToken(asset.info)) {
        coins = coins.add(
          new Coin(asset.info.native_token.denom, asset.amount)
        );
      }
    });

    return this.createExecuteMsg(
      {
        provide_liquidity: {
          assets
        }
      },
      coins
    );
  }

  public swap(
    offer_asset: Asset,
    params: {
      belief_price?: Numeric.Input;
      max_spread?: Numeric.Input;
      offer_token?: TerraswapToken;
      to?: AccAddress;
    }
  ): MsgExecuteContract {
    if (!params.offer_token) {
      if (!isNativeToken(offer_asset.info)) {
        throw new Error('OfferToken must be provided - unable to swap');
      }

      return this.createExecuteMsg(
        {
          swap: {
            offer_asset,
            belief_price: params.belief_price
              ? new Dec(params.belief_price).toString()
              : undefined,
            max_spread: params.max_spread
              ? new Dec(params.max_spread).toString()
              : undefined,
            to: params.to
          }
        },
        [new Coin(offer_asset.info.native_token.denom, offer_asset.amount)]
      );
    }

    if (!this.contractAddress) {
      throw new Error(
        'contractAddress not provided - unable to execute message'
      );
    }

    return params.offer_token.send(
      this.contractAddress,
      offer_asset.amount,
      createHookMsg({
        swap: {
          belief_price: params.belief_price
            ? new Dec(params.belief_price).toString()
            : undefined,
          max_spread: params.max_spread
            ? new Dec(params.max_spread).toString()
            : undefined,
          to: params.to
        }
      })
    );
  }

  public withdrawLiquidity(
    amount: Numeric.Input,
    lp_token: TerraswapToken
  ): MsgExecuteContract {
    if (!this.contractAddress) {
      throw new Error(
        'contractAddress not provided - unable to execute message'
      );
    }

    return lp_token.send.call(
      this,
      this.contractAddress,
      amount,
      createHookMsg({
        withdraw_liquidity: {}
      })
    );
  }

  public async getPair(): Promise<TerraswapPair.PairResponse> {
    return this.query({
      pair: {}
    });
  }

  public async getPool(): Promise<TerraswapPair.PoolResponse> {
    return this.query({
      pool: {}
    });
  }

  public async getSimulation(
    offer_asset: Asset
  ): Promise<TerraswapPair.SimulationResponse> {
    return this.query({
      simulation: {
        offer_asset
      }
    });
  }

  public async getReverseSimulation(
    ask_asset: Asset
  ): Promise<TerraswapPair.ReverseSimulationResponse> {
    return this.query({
      reverse_simulation: {
        ask_asset
      }
    });
  }

  protected async query<T>(query_msg: TerraswapPair.QueryMsg): Promise<T> {
    return super.query(query_msg);
  }

  protected createExecuteMsg(
    execute_msg: TerraswapPair.HandleMsg,
    coins: Coins.Input = {}
  ): MsgExecuteContract {
    return super.createExecuteMsg(execute_msg, coins);
  }
}
