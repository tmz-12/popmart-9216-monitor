export const TARGET='10052271402683055271007';
export const CONTROL='10052271402682611915003';
export const products={
  [TARGET]:['Owala','Tritan','740ml','柔光粉'],
  [CONTROL]:['BlenderBottle','酷洛米','740ml']
};
export function classify(sample,id) {
  if(!products[id] || sample.path!==`/product/${id}` || !products[id].every(x=>sample.name.includes(x))) return 'unknown';
  if(sample.blocked) return 'unknown';
  if(sample.notify && !sample.cart && !sample.buy) return 'sold_out';
  if(!sample.notify && sample.cart && sample.buy) return 'in_stock';
  return 'unknown';
}
