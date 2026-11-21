// Llamadas a ms-categorias (puerto 8084). La direccion se toma de Eureka (MS-CATEGORIAS);
// si no esta registrado, se usa VITE_CATEGORIAS_URL de .env.local.
import { CATEGORIAS_URL, pedir } from './cliente';
import { urlEnEureka } from './servicios';

async function base() {
  const url = (await urlEnEureka('MS-CATEGORIAS')) || CATEGORIAS_URL;
  if (!url) throw new Error('No se encontró el servicio de categorías');
  return `${url.replace(/\/$/, '')}/api/v1/categorias`;
}

// GET /categorias -> activas; con todas=true tambien las dadas de baja (solo ADMINISTRADOR)
export async function listarCategorias(todas, token) {
  return pedir(`${await base()}${todas ? '?todas=true' : ''}`, { token });
}

// GET /categorias/buscar/{nombre} -> las que contienen el texto en el nombre
export async function buscarCategorias(nombre, todas, token) {
  return pedir(`${await base()}/buscar/${encodeURIComponent(nombre)}${todas ? '?todas=true' : ''}`, { token });
}

// POST /categorias -> 201; si el nombre existe dado de baja, se reactiva
export async function crearCategoria(categoria, token) {
  return pedir(await base(), { metodo: 'POST', cuerpo: categoria, token });
}

// PUT /categorias/{id}
export async function actualizarCategoria(id, categoria, token) {
  return pedir(`${await base()}/${id}`, { metodo: 'PUT', cuerpo: categoria, token });
}

// DELETE /categorias/{id} -> baja logica (estatus 0)
export async function eliminarCategoria(id, token) {
  return pedir(`${await base()}/${id}`, { metodo: 'DELETE', token });
}
