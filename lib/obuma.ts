export const obumaService = {
  // Traer todas las categorías
  getCategorias: async () => {
    const res = await fetch('/api/obuma/categorias');
    return res.json();
  },

  // Crear el producto
  createProducto: async (data: any) => {
    const res = await fetch('/api/obuma/productos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  }
};