import { useState } from "react";
import {
  LuCalendarDays,
  LuCheck,
  LuMail,
  LuPencil,
  LuLockKeyhole,
  LuShieldAlert,
  LuUserRound,
} from "react-icons/lu";
import { useAuth } from "../../auth/hooks/useAuth";
import { changePassword } from "../../auth/api/auth";
import { clearSession } from "../../../shared/api/client";
import {
  Page,
  Panel,
  Field,
  Button,
  Notice,
} from "../../../shared/components/UI";
import { Modal } from "../../../shared/components/Modal";

const dangerActions = {
  password: {
    title: "Cambiar contraseña",
    description:
      "Usa una contraseña larga y única. Después tendrás que iniciar sesión nuevamente.",
    icon: LuLockKeyhole,
  },
};

export function Profile() {
  const { user, updateProfile } = useAuth();
  const [activeAction, setActiveAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const resetFeedback = () => {
    setError(null);
    setMessage("");
  };

  async function submitProfile(event) {
    event.preventDefault();
    setBusy(true);
    resetFeedback();
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      await updateProfile(body);
      setMessage("Tus datos básicos fueron actualizados.");
      setIsEditModalOpen(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function submitDangerAction(event) {
    event.preventDefault();
    setBusy(true);
    resetFeedback();
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      if (activeAction === "password") {
        await changePassword(body);
        clearSession();
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || user?.username?.[0] || ""}`.toUpperCase();
  const joinedDate = user?.date_joined
    ? new Date(user.date_joined).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "No disponible";
  const roleLabel =
    user?.roles
      ?.map((role) =>
        role.name === "admin"
          ? "Administrador"
          : role.name === "analyst"
            ? "Analista"
            : role.name,
      )
      .join(", ") || "Sin roles asignados";

  return (
    <Page title="Mi perfil">
      <section className="fg-profile-hero">
        <div className="fg-profile-avatar" aria-hidden="true">
          {initials || <LuUserRound size={28} />}
        </div>
        <div className="min-w-0">
          <p className="fg-eyebrow">Cuenta personal</p>
          <h2>{user?.first_name || user?.username}</h2>
          <p>
            {user?.role === "admin" ? "Administrador" : "Analista"} ·{" "}
            {user?.email}
          </p>
        </div>
        <span className="fg-profile-status">
          <span aria-hidden="true" />
          Cuenta activa
        </span>
      </section>

      <div className="fg-profile-flow">
        <section className="fg-profile-step">
          <Panel>
            <div className="fg-profile-section-heading">
              <div>
                <p className="fg-eyebrow">Información personal</p>
                <h2>Datos básicos</h2>
                <p>Consulta y actualiza la información asociada a tu cuenta.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetFeedback();
                  setIsEditModalOpen(true);
                }}
              >
                <LuPencil aria-hidden="true" />
                Editar información
              </Button>
            </div>
            <dl className="fg-profile-details">
              <div>
                <dt>Rol</dt>
                <dd>
                  <span className="fg-profile-value-icon">
                    <LuShieldAlert aria-hidden="true" />
                  </span>
                  {roleLabel}
                </dd>
              </div>
              <div>
                <dt>Usuario</dt>
                <dd>{user?.username || "No disponible"}</dd>
              </div>
              <div>
                <dt>Nombre</dt>
                <dd>{user?.first_name || "No registrado"}</dd>
              </div>
              <div>
                <dt>Apellido</dt>
                <dd>{user?.last_name || "No registrado"}</dd>
              </div>
              <div>
                <dt>Correo electrónico</dt>
                <dd>
                  <LuMail aria-hidden="true" />
                  {user?.email || "No disponible"}
                </dd>
              </div>
              <div>
                <dt>Miembro desde</dt>
                <dd>
                  <LuCalendarDays aria-hidden="true" />
                  {joinedDate}
                </dd>
              </div>
            </dl>
          </Panel>
        </section>

        <section className="fg-profile-step fg-profile-step-danger">
          <Panel>
            <div className="fg-profile-section-heading">
              <div>
                <p className="fg-eyebrow">Seguridad y acceso</p>
                <h2>Zona de peligro</h2>
                <p>La contraseña protege el acceso a tu cuenta.</p>
              </div>
              <LuShieldAlert className="text-amber-300" size={26} />
            </div>

            <div className="fg-danger-actions">
              {Object.entries(dangerActions).map(([action, item]) => {
                const Icon = item.icon;
                return (
                  <div className="fg-danger-action" key={action}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="fg-danger-icon">
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetFeedback();
                        setActiveAction(action);
                      }}
                    >
                      Configurar
                    </Button>
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <Notice error={error}>{message}</Notice>
      </div>
      {activeAction && (
        <Modal
          title={dangerActions[activeAction].title}
          onClose={() => setActiveAction(null)}
          busy={busy}
        >
          <div className="fg-modal-intro fg-modal-intro-danger">
            <span>
              {(() => {
                const ActionIcon = dangerActions[activeAction].icon;
                return <ActionIcon aria-hidden="true" />;
              })()}
            </span>
            <p>{dangerActions[activeAction].description}</p>
          </div>
          <form
            onSubmit={submitDangerAction}
            className="fg-modal-form"
            key={activeAction}
          >
            <Field
              label="Contraseña actual"
              name="old_password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Field
              label="Nueva contraseña"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
            />
            <div className="fg-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setActiveAction(null)}
              >
                Cancelar
              </Button>
              <Button disabled={busy} variant="danger">
                <LuCheck aria-hidden="true" />
                Actualizar contraseña
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {isEditModalOpen && (
        <Modal
          title="Editar información básica"
          onClose={() => setIsEditModalOpen(false)}
          busy={busy}
        >
          <div className="fg-modal-intro">
            <span>
              <LuPencil aria-hidden="true" />
            </span>
            <p>
              Actualiza los datos con los que te identificas en ForestGuard.
              Cambiar el usuario modificará la forma en que inicias sesión.
            </p>
          </div>
          <form onSubmit={submitProfile} className="fg-modal-form">
            <div className="fg-modal-section">
              <div className="fg-modal-section-heading">
                <div>
                  <p className="fg-eyebrow">Identidad de acceso</p>
                  <h3>¿Cómo ingresas a ForestGuard?</h3>
                </div>
                <LuUserRound aria-hidden="true" />
              </div>
              <Field
                label="Usuario"
                name="username"
                autoComplete="username"
                required
                defaultValue={user?.username || ""}
              />
              <div className="fg-profile-username-warning">
                <LuShieldAlert aria-hidden="true" />
                <p>
                  <strong>Importante:</strong> si cambias tu usuario, deberás
                  utilizar el nuevo para iniciar sesión la próxima vez.
                </p>
              </div>
            </div>

            <div className="fg-modal-section">
              <div className="fg-modal-section-heading">
                <div>
                  <p className="fg-eyebrow">Información personal</p>
                  <h3>Datos de contacto</h3>
                </div>
                <LuMail aria-hidden="true" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nombre"
                  name="first_name"
                  autoComplete="given-name"
                  defaultValue={user?.first_name || ""}
                />
                <Field
                  label="Apellido"
                  name="last_name"
                  autoComplete="family-name"
                  defaultValue={user?.last_name || ""}
                />
              </div>
              <Field
                label="Correo electrónico"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={user?.email || ""}
              />
            </div>

            <div className="fg-modal-readonly">
              <div>
                <span>
                  <LuCheck aria-hidden="true" />
                  Datos protegidos
                </span>
                <p>Estos datos son administrados por el sistema.</p>
              </div>
              <p>
                Rol: <strong>{roleLabel}</strong>
                <span aria-hidden="true"> · </span>
                Miembro desde: <strong>{joinedDate}</strong>
              </p>
            </div>
            <div className="fg-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button disabled={busy}>
                <LuCheck aria-hidden="true" />
                Guardar cambios
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
}
