// Gestion de usuarios (solo ADMINISTRADOR): lista de ms-usuarios por tipo, busqueda,
// activar o desactivar (PATCH /estado) y dar de alta con cualquier rol (POST /auth/admin/registro).
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useDatos from '../hooks/useDatos';
import { cambiarEstado, listarUsuarios, subirFoto } from '../api/usuarios';
import { correoNoEnviado, registroAdmin } from '../api/auth';
import Icono from '../components/Icono';
import { Aviso, Avatar, Boton, SelectorFoto, Campo, Entrada, Estado, ErrorServicio, EsqueletoTabla, Modal, Panel, Pestanas, Selector, Tarjeta, TituloPagina, Vacio } from '../components/ui';
import { TIPOS, documento, nombreCompleto, nombreTipo, telefono } from '../utils/formato';

const CON_RFC = ['DOCENTE', 'ADMINISTRADOR', 'ORGANIZADOR'];
const VACIO = { tipoUsuario: 'DOCENTE', nombre: '', apellidos: '', numeroControl: '', rfc: '', email: '', telefono: '', password: '' };

function NuevoUsuario({ abierto, onCerrar, onCreado }) {
  const { sesion } = useAuth();
  const [form, setForm] = useState(VACIO);
  // Foto elegida (ya recortada); se sube a ms-usuarios despues de crear la cuenta, cuando ya hay id
  const [foto, setFoto] = useState(null);
  const vista = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => vista && URL.revokeObjectURL(vista), [vista]);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const conRfc = CON_RFC.includes(form.tipoUsuario);

  async function guardar() {
    const x = {};
    if (!form.nombre.trim()) x.nombre = 'Obligatorio';
    if (!form.apellidos.trim()) x.apellidos = 'Obligatorio';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) x.email = 'Correo no válido';
    if (form.tipoUsuario === 'ESTUDIANTE' && !form.numeroControl.trim()) x.numeroControl = 'El estudiante necesita número de control';
    if (conRfc && !form.rfc.trim()) x.rfc = 'Este tipo necesita RFC';
    if (form.telefono && !/^[0-9]{10,15}$/.test(form.telefono)) x.telefono = 'Solo números, de 10 a 15 dígitos';
    if (form.password.length < 8) x.password = 'Mínimo 8 caracteres';
    setErrores(x);
    if (Object.keys(x).length) return;

    setEnviando(true);
    setError(null);
    try {
      const r = await registroAdmin(
        {
          tipoUsuario: form.tipoUsuario,
          nombre: form.nombre.trim(),
          apellidos: form.apellidos.trim(),
          numeroControl: form.tipoUsuario === 'ESTUDIANTE' ? form.numeroControl.trim() : null,
          rfc: conRfc ? form.rfc.trim().toUpperCase() : null,
          email: form.email.trim(),
          telefono: form.telefono || null,
          password: form.password,
        },
        sesion.token,
      );
      // La cuenta ya existe: si falla la foto no se deshace, solo se avisa
      let avisoFoto = null;
      if (foto && r?.usuarioId) {
        try {
          await subirFoto(r.usuarioId, foto, sesion.token);
        } catch (err) {
          avisoFoto = `La cuenta se creó, pero la foto no se pudo guardar: ${err.message}`;
        }
      }
      setForm(VACIO);
      setFoto(null);
      onCreado(form, r?.avisoCorreo, avisoFoto);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const usuario = form.tipoUsuario === 'ESTUDIANTE' ? form.numeroControl : conRfc ? form.rfc.toUpperCase() : form.email;

  return (
    <Panel
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nuevo usuario"
      subtitulo="El administrador puede crear cualquier tipo de cuenta."
      pie={
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="person_add" cargando={enviando} onClick={guardar}>
            Crear usuario
          </Boton>
        </div>
      }
    >
      {error && (
        <Aviso tipo="error" className="mb-4">
          {error}
        </Aviso>
      )}
      <SelectorFoto
        perfil={{ nombre: form.nombre, apellidos: form.apellidos }}
        foto={vista}
        onElegir={async (archivo) => setFoto(archivo)}
        onQuitar={() => setFoto(null)}
        className="mb-6 pb-6 border-b border-borde"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Tipo de usuario" obligatorio className="sm:col-span-2">
          <Selector name="tipoUsuario" value={form.tipoUsuario} onChange={cambiar} className="h-11">
            {Object.entries(TIPOS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Nombre" obligatorio error={errores.nombre}>
          <Entrada name="nombre" value={form.nombre} onChange={cambiar} error={errores.nombre} />
        </Campo>
        <Campo etiqueta="Apellidos" obligatorio error={errores.apellidos}>
          <Entrada name="apellidos" value={form.apellidos} onChange={cambiar} error={errores.apellidos} />
        </Campo>
        {form.tipoUsuario === 'ESTUDIANTE' && (
          <Campo etiqueta="Número de control" obligatorio error={errores.numeroControl} className="sm:col-span-2">
            <Entrada icono="badge" name="numeroControl" value={form.numeroControl} onChange={cambiar} error={errores.numeroControl} />
          </Campo>
        )}
        {conRfc && (
          <Campo etiqueta="RFC" obligatorio error={errores.rfc} className="sm:col-span-2">
            <Entrada icono="badge" name="rfc" maxLength={13} value={form.rfc} onChange={cambiar} error={errores.rfc} className="uppercase" />
          </Campo>
        )}
        <Campo etiqueta="Correo" obligatorio error={errores.email} className="sm:col-span-2">
          <Entrada icono="mail" name="email" type="email" value={form.email} onChange={cambiar} error={errores.email} />
        </Campo>
        <Campo etiqueta="Teléfono" error={errores.telefono} ayuda="Opcional, 10 dígitos.">
          <Entrada icono="call" name="telefono" inputMode="numeric" value={form.telefono} onChange={cambiar} error={errores.telefono} />
        </Campo>
        <Campo etiqueta="Contraseña inicial" obligatorio error={errores.password} ayuda="Mínimo 8 caracteres.">
          <Entrada icono="lock" name="password" type="password" autoComplete="new-password" value={form.password} onChange={cambiar} error={errores.password} />
        </Campo>
      </div>
      {usuario && (
        <div className="mt-5 rounded-lg bg-oro-tinte border border-oro-borde px-4 py-3 text-sm">
          <p className="etiqueta text-oro">Usuario para iniciar sesión</p>
          <p className="font-mono text-texto mt-0.5">{usuario}</p>
        </div>
      )}
    </Panel>
  );
}

export default function Usuarios() {
  const { sesion } = useAuth();
  const datos = useDatos(() => listarUsuarios({}, sesion.token), [sesion.token]);
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [texto, setTexto] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const todos = useMemo(() => datos.datos ?? [], [datos.datos]);
  const cuentas = useMemo(() => {
    const c = {};
    todos.forEach((u) => (c[u.tipoUsuario] = (c[u.tipoUsuario] ?? 0) + 1));
    return c;
  }, [todos]);

  const lista = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return todos.filter(
      (u) =>
        (!tipo || u.tipoUsuario === tipo) &&
        (!estado || u.estado === estado) &&
        (!t || [nombreCompleto(u), u.email, u.numeroControl, u.rfc].some((v) => v?.toLowerCase().includes(t))),
    );
  }, [todos, tipo, estado, texto]);

  async function alternar() {
    const u = confirmar;
    const destino = u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    setTrabajando(true);
    try {
      await cambiarEstado(u.id, destino, sesion.token);
      setMensaje({ tipo: 'exito', texto: `${nombreCompleto(u)} quedó ${destino === 'ACTIVO' ? 'activo' : 'inactivo'}.` });
      datos.recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  }

  const activos = todos.filter((u) => u.estado === 'ACTIVO').length;

  return (
    <>
      <TituloPagina titulo="Usuarios" subtitulo={datos.datos ? `${todos.length} registrados · ${activos} activos` : 'Cuentas del sistema'}>
        <Boton icono="person_add" onClick={() => setNuevo(true)}>
          Nuevo usuario
        </Boton>
      </TituloPagina>

      {mensaje && (
        <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)} className="mb-4">
          {mensaje.texto}
        </Aviso>
      )}

      <div className="mb-4">
        <Pestanas
          valor={tipo}
          onChange={setTipo}
          opciones={[{ valor: '', texto: 'Todos', cuenta: datos.datos ? todos.length : null }, ...Object.entries(TIPOS).map(([v, t]) => ({ valor: v, texto: t, cuenta: datos.datos ? cuentas[v] ?? 0 : null }))]}
        />
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="flex flex-wrap gap-3 p-4 border-b border-borde">
          <Entrada icono="search" placeholder="Buscar por nombre, correo, número de control o RFC" value={texto} onChange={(e) => setTexto(e.target.value)} className="h-10 flex-1 min-w-[220px]" />
          <Selector value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado" className="w-44">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </Selector>
        </div>

        {datos.error && !datos.datos ? (
          <ErrorServicio servicio="El servicio de usuarios" mensaje={datos.error.message} onReintentar={datos.recargar} />
        ) : !datos.datos ? (
          <EsqueletoTabla filas={6} columnas={5} />
        ) : lista.length === 0 ? (
          <Vacio icono="group_off" titulo="No hay usuarios con estos filtros" />
        ) : (
          <div className="overflow-x-auto scroll-fino">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="etiqueta text-texto-2 bg-lienzo">
                  <th className="px-5 py-2.5 font-semibold">Usuario</th>
                  <th className="px-3 py-2.5 font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 font-semibold">Identificación</th>
                  <th className="px-3 py-2.5 font-semibold">Teléfono</th>
                  <th className="px-3 py-2.5 font-semibold">Estado</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const doc = documento(u);
                  const yo = u.id === sesion.usuarioId;
                  return (
                    <tr key={u.id} className="border-t border-borde-suave hover:bg-lienzo">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar perfil={u} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-texto truncate">
                              {nombreCompleto(u)} {yo && <span className="text-xs text-texto-2">(tú)</span>}
                            </p>
                            <p className="text-xs text-texto-2 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-texto">{nombreTipo(u.tipoUsuario)}</td>
                      <td className="px-3 py-3">
                        <p className="text-[11px] text-texto-2">{doc.etiqueta}</p>
                        <p className="font-mono text-xs text-texto">{doc.valor}</p>
                      </td>
                      <td className="px-3 py-3 text-sm text-texto-2 tabular whitespace-nowrap">{telefono(u.telefono)}</td>
                      <td className="px-3 py-3">
                        <Estado valor={u.estado} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!yo && (
                          <Boton variante={u.estado === 'ACTIVO' ? 'fantasma' : 'secundario'} tamano="sm" icono={u.estado === 'ACTIVO' ? 'person_off' : 'person_check'} onClick={() => setConfirmar(u)}>
                            {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                          </Boton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <NuevoUsuario
        abierto={nuevo}
        onCerrar={() => setNuevo(false)}
        onCreado={(f, avisoCorreo, avisoFoto) => {
          setNuevo(false);
          setMensaje({
            tipo: avisoFoto || correoNoEnviado(avisoCorreo) ? 'aviso' : 'exito',
            texto: [`Se creó la cuenta de ${f.nombre} ${f.apellidos}.`, avisoCorreo && `${avisoCorreo}.`, avisoFoto].filter(Boolean).join(' '),
          });
          datos.recargar();
        }}
      />

      <Modal abierto={!!confirmar} onCerrar={() => !trabajando && setConfirmar(null)}>
        {confirmar && (
          <div className="p-6">
            <span className={`size-12 rounded-full grid place-items-center mb-4 ${confirmar.estado === 'ACTIVO' ? 'bg-peligro-tinte text-peligro' : 'bg-exito-tinte text-exito'}`}>
              <Icono nombre={confirmar.estado === 'ACTIVO' ? 'person_off' : 'person_check'} className="text-[24px]" />
            </span>
            <h2 className="font-titulo text-lg font-semibold text-texto">
              {confirmar.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'} a {nombreCompleto(confirmar)}
            </h2>
            <p className="text-sm text-texto-2 mt-1">
              {confirmar.estado === 'ACTIVO' ? 'Ya no podrá iniciar sesión hasta que lo vuelvas a activar.' : 'Podrá volver a iniciar sesión.'}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <Boton variante="secundario" onClick={() => setConfirmar(null)} disabled={trabajando}>
                Cancelar
              </Boton>
              <Boton variante={confirmar.estado === 'ACTIVO' ? 'peligro' : 'primario'} cargando={trabajando} onClick={alternar}>
                {confirmar.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
