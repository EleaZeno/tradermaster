
import React from 'react';
import { ResourceType, ResourceItem, ProductType, ProductItem } from '../../types';
import { RESOURCE_ICONS } from '../../constants';
import { Card } from '../Card';
import { Button } from '../Button';

interface MarketTabProps {
  resources: Record<ResourceType, ResourceItem>;
  products: Record<ProductType, ProductItem>;
  cash: number;
  onTrade: (type: 'buy' | 'sell', resId: ResourceType) => void;
}

export const MarketTab: React.FC<MarketTabProps> = ({ resources, products, cash, onTrade }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
        <div className="col-span-full p-4 bg-stone-900 rounded border border-stone-800 text-center text-stone-500">
            请前往“商品交易”面板进行操作。
        </div>
    </div>
  );
};
