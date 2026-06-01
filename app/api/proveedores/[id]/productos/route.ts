// app/api/proveedores/[id]/productos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseAdmin';

// GET: Obtener todos los productos de un proveedor específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data, error } = await supabase
      .from('proveedor_productos')
      .select('*')
      .eq('proveedor_id', id)
      .order('producto_nombre', { ascending: true });
    
    if (error) throw error;
    
    return NextResponse.json({ 
      success: true, 
      productos: data,
      total: data.length 
    });
  } catch (error: any) {
    console.error('Error en GET /api/proveedores/[id]/productos:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Agregar un nuevo producto a un proveedor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { producto_nombre, categoria, ultimo_precio, fecha_ultima_compra, producto_sku } = body;
    
    if (!producto_nombre) {
      return NextResponse.json(
        { success: false, error: 'El nombre del producto es obligatorio' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
      .from('proveedor_productos')
      .insert({
        proveedor_id: id,
        producto_nombre,
        producto_sku: producto_sku || null,
        categoria: categoria || null,
        ultimo_precio: ultimo_precio || null,
        fecha_ultima_compra: fecha_ultima_compra || null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, producto: data });
  } catch (error: any) {
    console.error('Error en POST /api/proveedores/[id]/productos:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar un producto de un proveedor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proveedorId } = await params;
    const { searchParams } = new URL(request.url);
    const productoId = searchParams.get('productoId');
    
    if (!productoId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere productoId' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('proveedor_productos')
      .delete()
      .eq('id', productoId)
      .eq('proveedor_id', proveedorId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en DELETE /api/proveedores/[id]/productos:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}