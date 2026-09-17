import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MenuItem, BOMRequirement, SweetnessLevel } from '../types';
import {
  Plus,
  Trash2,
  X,
  Check,
  Coffee,
  Sparkles,
  Layers,
  Scale,
} from 'lucide-react';

interface AddMenuRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuToEdit?: MenuItem | null;
}

export const AddMenuRecipeModal: React.FC<AddMenuRecipeModalProps> = ({
  isOpen,
  onClose,
  menuToEdit,
}) => {
  const { ingredients, addMenuItem, updateMenuItem } = useApp();

  const [name, setName] = useState(menuToEdit?.name || '');
  const [category, setCategory] = useState<MenuItem['category']>(
    menuToEdit?.category || 'smoothie'
  );
  const [basePrice, setBasePrice] = useState<string>(
    menuToEdit ? String(menuToEdit.basePrice) : '45'
  );
  const [image, setImage] = useState(menuToEdit?.image || '🥤');
  const [description, setDescription] = useState(
    menuToEdit?.description || ''
  );
  const [defaultSweetness, setDefaultSweetness] = useState<SweetnessLevel>(
    menuToEdit?.defaultSweetness || '50%'
  );
  const [allowIcedOrBlended, setAllowIcedOrBlended] = useState(
    menuToEdit ? menuToEdit.allowIcedOrBlended : true
  );
  const [baseCalories, setBaseCalories] = useState<string>(
    menuToEdit?.baseCalories ? String(menuToEdit.baseCalories) : '160'
  );

  // BOM ingredients
  const [bomList, setBomList] = useState<BOMRequirement[]>(() => {
    if (menuToEdit && menuToEdit.bom.length > 0) {
      return [...menuToEdit.bom];
    }
    // Default starting recipe with mango or first available ingredient
    const firstIng = ingredients[0];
    return firstIng
      ? [
          {
            ingredientId: firstIng.id,
            baseAmount: 100,
            unit: firstIng.unit,
            scalesWithSweetness: false,
          },
        ]
      : [];
  });

  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddBOMRow = () => {
    const available = ingredients.find(
      (ing) => !bomList.some((b) => b.ingredientId === ing.id)
    );
    const target = available || ingredients[0];
    if (!target) return;

    setBomList([
      ...bomList,
      {
        ingredientId: target.id,
        baseAmount: target.unit === 'ml' ? 25 : target.unit === 'g' ? 100 : 1,
        unit: target.unit,
        scalesWithSweetness: target.category === 'sweetener',
      },
    ]);
  };

  const handleRemoveBOMRow = (index: number) => {
    setBomList(bomList.filter((_, i) => i !== index));
  };

  const handleBOMChange = (
    index: number,
    field: keyof BOMRequirement,
    value: unknown
  ) => {
    const updated = [...bomList];
    if (field === 'ingredientId') {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) {
        updated[index] = {
          ...updated[index],
          ingredientId: ing.id,
          unit: ing.unit,
          scalesWithSweetness: ing.category === 'sweetener',
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    setBomList(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('กรุณาระบุชื่อเมนู');
      return;
    }

    const priceNum = parseFloat(basePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('กรุณาระบุราคาขายที่ถูกต้อง');
      return;
    }

    if (bomList.length === 0) {
      setFormError('กรุณาเลือกวัตถุดิบในสูตรอย่างน้อย 1 รายการ');
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      basePrice: priceNum,
      image: image.trim() || '🥤',
      description: description.trim() || `เมนู${name.trim()} ปั่นสดอร่อยเข้มข้น`,
      defaultSweetness,
      allowIcedOrBlended,
      baseCalories: parseInt(baseCalories) || 150,
      bom: bomList.map((b) => ({
        ...b,
        baseAmount: Number(b.baseAmount) || 1,
      })),
    };

    if (menuToEdit) {
      updateMenuItem(menuToEdit.id, payload);
    } else {
      addMenuItem(payload);
    }

    onClose();
  };

  const emojiPresets = ['🥤', '🥭', '🍓', '🥑', '🥥', '🍊', '🍉', '🍌', '🍍', '🍵', '🧋', '🥛', '🫐', '🍋'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200 my-4">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">
                {menuToEdit ? 'แก้ไขสูตรและข้อมูลเมนู' : 'เพิ่มสูตรและเมนูใหม่'}
              </h2>
              <p className="text-xs text-amber-100 mt-0.5">
                ผูกสูตรวัตถุดิบ (BOM) เพื่อให้ระบบตัดสต็อกและเตือนของหมดอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors -mr-1 -mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold">
              ⚠️ {formError}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold text-stone-800 block mb-1">
                ชื่อเมนูเครื่องดื่ม *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ชาไทยปั่นเฉาก๊วย, มะพร้าวน้ำหอมปั่นนมสด"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 text-sm focus:border-amber-500"
              />
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">หมวดหมู่</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MenuItem['category'])}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
              >
                <option value="smoothie">สมูทตี้ผลไม้ (Smoothie)</option>
                <option value="juice">น้ำผลไม้สด (Fresh Juice)</option>
                <option value="milky">นมสด / นมปั่น (Milky)</option>
                <option value="tea">ชา / กาแฟโบราณ (Tea & Coffee)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">ราคาขาย (บาท) *</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                placeholder="เช่น 45"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900"
              />
            </div>

            {/* Emoji Selection */}
            <div>
              <label className="font-bold text-stone-800 block mb-1">ไอคอน / อิโมจิ</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-14 text-center text-xl py-1.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
                <div className="flex flex-wrap gap-1">
                  {emojiPresets.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setImage(em)}
                      className="w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center text-sm"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">แคลอรี่โดยประมาณ (kcal)</label>
              <input
                type="number"
                value={baseCalories}
                onChange={(e) => setBaseCalories(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">ความหวานเริ่มต้น</label>
              <select
                value={defaultSweetness}
                onChange={(e) => setDefaultSweetness(e.target.value as SweetnessLevel)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
              >
                <option value="50%">หวาน 50% (หวานน้อย)</option>
                <option value="100%">หวาน 100% (หวานปกติ)</option>
                <option value="25%">หวาน 25% (หวานน้อยมาก)</option>
                <option value="0%">หวาน 0% (ไม่หวาน)</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer w-full mt-2 sm:mt-5">
                <input
                  type="checkbox"
                  checked={allowIcedOrBlended}
                  onChange={(e) => setAllowIcedOrBlended(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="font-semibold text-stone-800">
                  รองรับทั้งแบบปั่น (🥤) และแบบเย็น (🧊)
                </span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-stone-800 block mb-1">คำอธิบายเมนู</label>
              <input
                type="text"
                placeholder="เช่น ปั่นสดเนื้อเนียน หอมหวานชื่นใจ ท็อปปิ้งเข้ากันได้ดี"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
          </div>

          {/* BOM Recipe Specification Section */}
          <div className="border-t border-stone-200 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>สูตรส่วนผสมวัตถุดิบต่อ 1 แก้ว (Bill of Materials - BOM) *</span>
                </h3>
                <p className="text-[11px] text-stone-500">
                  ระบบจะตัดสต็อกวัตถุดิบเหล่านี้อัตโนมัติทุกครั้งที่มีออเดอร์
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddBOMRow}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ เพิ่มวัตถุดิบในสูตร</span>
              </button>
            </div>

            <div className="space-y-2">
              {bomList.map((item, idx) => {
                const ing = ingredients.find((i) => i.id === item.ingredientId);

                return (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex flex-wrap items-center gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-[140px]">
                      <label className="text-[10px] text-stone-500 block mb-0.5">
                        วัตถุดิบ #{idx + 1}
                      </label>
                      <select
                        value={item.ingredientId}
                        onChange={(e) =>
                          handleBOMChange(idx, 'ingredientId', e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg font-medium"
                      >
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <label className="text-[10px] text-stone-500 block mb-0.5">
                        ปริมาณ/แก้ว
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          required
                          value={item.baseAmount}
                          onChange={(e) =>
                            handleBOMChange(
                              idx,
                              'baseAmount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-right font-bold"
                        />
                        <span className="text-[11px] text-stone-600 font-medium">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-4">
                      <label
                        className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer"
                        title="หากติ๊ก ปริมาณนี้จะลดลงเมื่อลูกค้าเลือกหวานน้อย หรือ 0%"
                      >
                        <input
                          type="checkbox"
                          checked={item.scalesWithSweetness || false}
                          onChange={(e) =>
                            handleBOMChange(
                              idx,
                              'scalesWithSweetness',
                              e.target.checked
                            )
                          }
                          className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                        />
                        <span>ปรับตามระดับหวาน</span>
                      </label>

                      {bomList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBOMRow(idx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 ml-1"
                          title="ลบวัตถุดิบนี้ออกจากสูตร"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 font-semibold hover:bg-stone-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{menuToEdit ? 'บันทึกการแก้ไขสูตร' : 'บันทึกเมนูใหม่'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
