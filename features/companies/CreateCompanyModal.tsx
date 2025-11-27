
import React, { useState } from 'react';
import { ProductType, ResourceType, ProductItem, ResourceItem, IndustryType } from '../../shared/types';
import { Card, Button } from '../../shared/components';
import { motion } from 'framer-motion';

interface CreateCompanyModalProps {
  products: Record<ProductType, ProductItem>;
  resources: Record<ResourceType, ResourceItem>; 
  cash: number;
  onClose: () => void;
  onCreate: (name: string, type: IndustryType) => void;
}

export const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({ cash, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(ResourceType.GRAIN);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <Card className="w-full bg-stone-900 border-stone-700" title="注册新公司 (IPO)">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-stone-500 block mb-1">公司名称</label>
                <input className="w-full bg-stone-950 border border-stone-700 rounded p-2 text-white" value={name} onChange={e => setName(e.target.value)} placeholder="例如: 兄弟粮仓" />
              </div>
              <div>
                <label className="text-xs text-stone-500 block mb-1">主营业务</label>
                <select className="w-full bg-stone-950 border border-stone-700 rounded p-2 text-white" value={type} onChange={e => setType(e.target.value)}>
                    <option value={ResourceType.GRAIN}>粮食种植 (原料)</option>
                    <option value={ProductType.BREAD}>面包烘焙 (加工)</option>
                </select>
              </div>
              <div className="p-3 bg-stone-800 rounded text-xs text-stone-400">
                <p>IPO 费用: 20 oz (大众创业)</p>
                <p>初始现金: 20 oz</p>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => onCreate(name, type as IndustryType)} disabled={cash < 20 || !name}>确认上市</Button>
                <Button className="flex-1" variant="secondary" onClick={onClose}>取消</Button>
              </div>
            </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};
