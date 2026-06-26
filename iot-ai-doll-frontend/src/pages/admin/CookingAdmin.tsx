/**
 * 料理系统管理 - 烹饪方式 + 菜谱 CRUD
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

// ─── 类型 ────────────────────────────────────────

interface CookingMethod {
  id: number;
  name: string;
  description: string;
  kitchen_bg_url: string;
  img_empty: string;
  img_loaded: string;
  img_0: string;
  img_1: string;
  img_2: string;
  img_3: string;
  img_4: string;
  img_5: string;
  is_active: boolean;
  sort_order: number;
}

interface RecipeIngredient {
  id?: number;
  ingredient_shop_item_id: number;
  quantity: number;
  ingredient_name?: string;
  ingredient_image?: string;
}

interface Recipe {
  id: number;
  cooking_method_id: number;
  name: string;
  description: string;
  image_url: string;
  dish_shop_item_id?: number;
  sort_order: number;
  is_active: boolean;
  method_name?: string;
  ingredients: RecipeIngredient[];
}

interface ShopItem {
  id: number;
  name: string;
  image_url: string;
  item_category: string;
}

const STAGE_IMAGES = [
  { key: 'img_empty', label: '空锅（无食材）' },
  { key: 'img_loaded', label: '有食材（未开火）' },
  { key: 'img_0', label: '① 刚开始煮' },
  { key: 'img_1', label: '② 稍微煮了一会儿' },
  { key: 'img_2', label: '③ 快熟了' },
  { key: 'img_3', label: '④ 刚好熟了 ★' },
  { key: 'img_4', label: '⑤ 有点老了' },
  { key: 'img_5', label: '⑥ 变成焦炭了' },
];

export default function CookingAdmin() {
  const [activeTab, setActiveTab] = useState<'methods' | 'recipes'>('methods');
  const [loading, setLoading] = useState(true);

  // 烹饪方式
  const [methods, setMethods] = useState<CookingMethod[]>([]);
  const [editingMethod, setEditingMethod] = useState<CookingMethod | null>(null);
  const [showMethodForm, setShowMethodForm] = useState(false);

  // 菜谱
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showRecipeForm, setShowRecipeForm] = useState(false);

  // 食材列表（shop_items food类别）
  const [foodItems, setFoodItems] = useState<ShopItem[]>([]);

  // 图片上传状态
  const [uploading, setUploading] = useState<string | null>(null);

  // ─── 加载 ────────────────────────────────────────

  const loadMethods = async () => {
    try {
      const res = await client.get('/epet1/cooking/admin/methods');
      setMethods(res.data?.methods || []);
    } catch (e) {
      console.error('load methods error', e);
    }
  };

  const loadRecipes = async () => {
    try {
      const res = await client.get('/epet1/cooking/admin/recipes');
      setRecipes(res.data?.recipes || []);
    } catch (e) {
      console.error('load recipes error', e);
    }
  };

  const loadFoodItems = async () => {
    try {
      const res = await client.get('/epet1/cooking/ingredients');
      setFoodItems(res.data?.ingredients || []);
    } catch (e) {
      console.error('load food items error', e);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadMethods(), loadRecipes(), loadFoodItems()]);
      setLoading(false);
    })();
  }, []);

  // ─── 图片上传 ─────────────────────────────────────

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'cooking');
    const res = await client.post('/game-assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
    return res.data?.asset?.url || '';
  };

  // ─── 烹饪方式 CRUD ───────────────────────────────

  const saveMethod = async (method: Partial<CookingMethod>) => {
    try {
      if (method.id) {
        await client.put(`/epet1/cooking/admin/methods/${method.id}`, method);
      } else {
        await client.post('/epet1/cooking/admin/methods', method);
      }
      setShowMethodForm(false);
      setEditingMethod(null);
      await loadMethods();
    } catch (e: any) {
      alert('保存失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const deleteMethod = async (id: number) => {
    if (!confirm('确定停用该烹饪方式？')) return;
    try {
      await client.delete(`/epet1/cooking/admin/methods/${id}`);
      await loadMethods();
    } catch (e: any) {
      alert('删除失败: ' + (e.response?.data?.error || e.message));
    }
  };

  // ─── 菜谱 CRUD ────────────────────────────────────

  const saveRecipe = async (recipe: Partial<Recipe> & { ingredients: RecipeIngredient[] }) => {
    try {
      if (recipe.id) {
        await client.put(`/epet1/cooking/admin/recipes/${recipe.id}`, {
          ...recipe,
          ingredients: recipe.ingredients.map(i => ({
            shop_item_id: i.ingredient_shop_item_id,
            quantity: i.quantity,
          })),
        });
      } else {
        await client.post('/epet1/cooking/admin/recipes', {
          ...recipe,
          ingredients: recipe.ingredients.map(i => ({
            shop_item_id: i.ingredient_shop_item_id,
            quantity: i.quantity,
          })),
        });
      }
      setShowRecipeForm(false);
      setEditingRecipe(null);
      await loadRecipes();
    } catch (e: any) {
      alert('保存失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const deleteRecipe = async (id: number) => {
    if (!confirm('确定停用该菜谱？')) return;
    try {
      await client.delete(`/epet1/cooking/admin/recipes/${id}`);
      await loadRecipes();
    } catch (e: any) {
      alert('删除失败: ' + (e.response?.data?.error || e.message));
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>加载中…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20 }}>🍳 料理系统管理</h2>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['methods', 'recipes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 700 : 400,
              background: activeTab === tab ? '#FF9800' : '#f0f0f0',
              color: activeTab === tab ? '#fff' : '#333',
            }}
          >
            {tab === 'methods' ? '🔥 烹饪方式' : '📖 菜谱'}
          </button>
        ))}
      </div>

      {/* ═══ 烹饪方式 ═══ */}
      {activeTab === 'methods' && (
        <div>
          <button
            onClick={() => { setEditingMethod(null); setShowMethodForm(true); }}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#4CAF50', color: '#fff', fontWeight: 600, cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            + 新增烹饪方式
          </button>

          {showMethodForm && (
            <MethodForm
              method={editingMethod}
              onSave={saveMethod}
              onCancel={() => { setShowMethodForm(false); setEditingMethod(null); }}
              uploading={uploading}
              setUploading={setUploading}
              onUpload={uploadImage}
            />
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>名称</th>
                <th style={thStyle}>描述</th>
                <th style={thStyle}>状态图预览</th>
                <th style={thStyle}>排序</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {methods.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{m.id}</td>
                  <td style={tdStyle}>{m.name}</td>
                  <td style={tdStyle}>{m.description}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {STAGE_IMAGES.map(si => (
                        <div key={si.key} style={{ width: 28, height: 28, background: '#eee', borderRadius: 4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}
                          title={si.label}
                        >
                          {(m as any)[si.key] ? '🖼️' : '❌'}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={tdStyle}>{m.sort_order}</td>
                  <td style={tdStyle}>{m.is_active ? '✅' : '❌'}</td>
                  <td style={tdStyle}>
                    <button onClick={() => { setEditingMethod(m); setShowMethodForm(true); }}
                      style={btnSmall}>编辑</button>
                    <button onClick={() => deleteMethod(m.id)} style={{...btnSmall, color: '#f44'}}>停用</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ 菜谱 ═══ */}
      {activeTab === 'recipes' && (
        <div>
          <button
            onClick={() => { setEditingRecipe(null); setShowRecipeForm(true); }}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#4CAF50', color: '#fff', fontWeight: 600, cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            + 新增菜谱
          </button>

          {showRecipeForm && (
            <RecipeForm
              recipe={editingRecipe}
              methods={methods}
              foodItems={foodItems}
              onSave={saveRecipe}
              onCancel={() => { setShowRecipeForm(false); setEditingRecipe(null); }}
              uploading={uploading}
              setUploading={setUploading}
              onUpload={uploadImage}
            />
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>菜谱名</th>
                <th style={thStyle}>烹饪方式</th>
                <th style={thStyle}>食材</th>
                <th style={thStyle}>成品图</th>
                <th style={thStyle}>排序</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{r.id}</td>
                  <td style={tdStyle}>{r.name}</td>
                  <td style={tdStyle}>{r.method_name || r.cooking_method_id}</td>
                  <td style={tdStyle}>
                    {r.ingredients?.map(i => (
                      <span key={i.ingredient_shop_item_id} style={{
                        display: 'inline-block', padding: '2px 6px', margin: 2,
                        background: '#fff3e0', borderRadius: 4, fontSize: 11,
                      }}>
                        {i.ingredient_name} ×{i.quantity}
                      </span>
                    ))}
                  </td>
                  <td style={tdStyle}>
                    {r.image_url ? <img src={r.image_url} style={{ width: 36, height: 36, objectFit: 'contain' }} /> : '❌'}
                  </td>
                  <td style={tdStyle}>{r.sort_order}</td>
                  <td style={tdStyle}>{r.is_active ? '✅' : '❌'}</td>
                  <td style={tdStyle}>
                    <button onClick={() => { setEditingRecipe(r); setShowRecipeForm(true); }}
                      style={btnSmall}>编辑</button>
                    <button onClick={() => deleteRecipe(r.id)} style={{...btnSmall, color: '#f44'}}>停用</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 烹饪方式表单 ──────────────────────────────────

function MethodForm({
  method,
  onSave,
  onCancel,
  uploading,
  setUploading,
  onUpload,
}: {
  method: CookingMethod | null;
  onSave: (m: Partial<CookingMethod>) => void;
  onCancel: () => void;
  uploading: string | null;
  setUploading: (k: string | null) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  const [form, setForm] = useState<Partial<CookingMethod>>(
    method || { name: '', description: '', sort_order: 0 }
  );

  const handleImageUpload = async (key: string, file: File) => {
    setUploading(key);
    try {
      const url = await onUpload(file);
      setForm(prev => ({ ...prev, [key]: url }));
    } catch (e) {
      alert('上传失败');
    }
    setUploading(null);
  };

  return (
    <div style={{
      background: '#fafafa', border: '1px solid #ddd', borderRadius: 12,
      padding: 20, marginBottom: 20,
    }}>
      <h3>{method ? '编辑烹饪方式' : '新增烹饪方式'}</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <label>
          名称
          <input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            style={inputStyle} />
        </label>
        <label>
          排序
          <input type="number" value={form.sort_order || 0} onChange={e => setForm(prev => ({ ...prev, sort_order: +e.target.value }))}
            style={inputStyle} />
        </label>
      </div>

      <label style={{ display: 'block', marginBottom: 12 }}>
        描述
        <input value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          style={inputStyle} />
      </label>

      {/* 厨房背景 */}
      <label style={{ display: 'block', marginBottom: 12 }}>
        厨房背景图
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {form.kitchen_bg_url && <img src={form.kitchen_bg_url} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />}
          <input type="file" accept="image/*" onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleImageUpload('kitchen_bg_url', f);
          }} disabled={uploading === 'kitchen_bg_url'} />
        </div>
        <input value={form.kitchen_bg_url || ''} onChange={e => setForm(prev => ({ ...prev, kitchen_bg_url: e.target.value }))}
          placeholder="或直接输入URL" style={inputStyle} />
      </label>

      {/* 8个状态图 */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>状态图片（8张）</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {STAGE_IMAGES.map(si => (
            <div key={si.key} style={{ padding: 8, background: '#fff', border: '1px solid #eee', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{si.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {(form as any)[si.key] ? (
                  <img src={(form as any)[si.key]} style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 40, height: 40, background: '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>空</div>
                )}
                <input type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(si.key, f);
                }} disabled={uploading === si.key} style={{ fontSize: 11 }} />
              </div>
              <input value={(form as any)[si.key] || ''} onChange={e => setForm(prev => ({ ...prev, [si.key]: e.target.value }))}
                placeholder="或直接输入URL" style={{ ...inputStyle, fontSize: 11 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(form)} style={{ padding: '8px 24px', borderRadius: 8, border: 'none',
          background: '#FF9800', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          保存
        </button>
        <button onClick={onCancel} style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid #ddd',
          background: '#fff', cursor: 'pointer' }}>
          取消
        </button>
      </div>
    </div>
  );
}

// ─── 菜谱表单 ──────────────────────────────────────

function RecipeForm({
  recipe,
  methods,
  foodItems,
  onSave,
  onCancel,
  uploading,
  setUploading,
  onUpload,
}: {
  recipe: Recipe | null;
  methods: CookingMethod[];
  foodItems: ShopItem[];
  onSave: (r: Partial<Recipe> & { ingredients: RecipeIngredient[] }) => void;
  onCancel: () => void;
  uploading: string | null;
  setUploading: (k: string | null) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  const [form, setForm] = useState({
    cooking_method_id: recipe?.cooking_method_id || (methods[0]?.id || 0),
    name: recipe?.name || '',
    description: recipe?.description || '',
    image_url: recipe?.image_url || '',
    sort_order: recipe?.sort_order || 0,
    is_active: recipe?.is_active ?? true,
  });

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients?.map(i => ({
      ingredient_shop_item_id: i.ingredient_shop_item_id,
      quantity: i.quantity,
      ingredient_name: i.ingredient_name,
      ingredient_image: i.ingredient_image,
    })) || [{ ingredient_shop_item_id: foodItems[0]?.id || 0, quantity: 1 }]
  );

  const addIngredient = () => {
    if (ingredients.length >= 3) return alert('最多3种食材');
    setIngredients(prev => [...prev, { ingredient_shop_item_id: foodItems[0]?.id || 0, quantity: 1 }]);
  };

  const removeIngredient = (idx: number) => {
    if (ingredients.length <= 2) return alert('至少2种食材');
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: keyof RecipeIngredient, value: any) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  };

  const handleImageUpload = async (file: File) => {
    setUploading('image_url');
    try {
      const url = await onUpload(file);
      setForm(prev => ({ ...prev, image_url: url }));
    } catch (e) {
      alert('上传失败');
    }
    setUploading(null);
  };

  return (
    <div style={{
      background: '#fafafa', border: '1px solid #ddd', borderRadius: 12,
      padding: 20, marginBottom: 20,
    }}>
      <h3>{recipe ? '编辑菜谱' : '新增菜谱'}</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <label>
          烹饪方式
          <select value={form.cooking_method_id} onChange={e => setForm(prev => ({ ...prev, cooking_method_id: +e.target.value }))}
            style={inputStyle}>
            {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>
          菜谱名称
          <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            style={inputStyle} />
        </label>
      </div>

      <label style={{ display: 'block', marginBottom: 12 }}>
        描述
        <input value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          style={inputStyle} />
      </label>

      {/* 食材选择 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h4>食材（2~3种）</h4>
          <button onClick={addIngredient} style={{ ...btnSmall, background: '#4CAF50', color: '#fff' }}>+ 加一种</button>
        </div>
        {ingredients.map((ing, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <select value={ing.ingredient_shop_item_id}
                onChange={e => updateIngredient(idx, 'ingredient_shop_item_id', +e.target.value)}
                style={{ ...inputStyle, flex: 2 }}>
                <option value={0}>选择食材…</option>
                {foodItems.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                数量
                <input type="number" min={1} max={5} value={ing.quantity}
                  onChange={e => updateIngredient(idx, 'quantity', +e.target.value)}
                  style={{ ...inputStyle, width: 60 }} />
              </label>
              <button onClick={() => removeIngredient(idx)} style={{ ...btnSmall, color: '#f44' }}>✕</button>
            </div>
        ))}
      </div>

      {/* 料理成品图 */}
      <label style={{ display: 'block', marginBottom: 16 }}>
        料理成品图
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {form.image_url ? <img src={form.image_url} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6 }} /> : null}
          <input type="file" accept="image/*" onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleImageUpload(f);
          }} disabled={uploading === 'image_url'} />
        </div>
        <input value={form.image_url} onChange={e => setForm(prev => ({ ...prev, image_url: e.target.value }))}
          placeholder="或直接输入URL" style={inputStyle} />
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ ...form, ingredients })} style={{
          padding: '8px 24px', borderRadius: 8, border: 'none',
          background: '#FF9800', color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>
          保存
        </button>
        <button onClick={onCancel} style={{
          padding: '8px 24px', borderRadius: 8, border: '1px solid #ddd',
          background: '#fff', cursor: 'pointer',
        }}>
          取消
        </button>
      </div>
    </div>
  );
}

// ─── 样式 ──────────────────────────────────────────

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'middle' };
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '6px 10px', borderRadius: 6,
  border: '1px solid #ddd', fontSize: 13, marginTop: 4,
};
const btnSmall: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 4, border: '1px solid #ddd',
  background: '#fff', cursor: 'pointer', fontSize: 12,
};
