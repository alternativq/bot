import { useCallback, useEffect, useState } from 'react';
import type { Page } from '../App';
import {
  adminAddInbound,
  adminDeleteSubscription,
  adminDeleteUserCompletely,
  adminExtendUser,
  adminGetPendingPayments,
  adminGetUser,
  adminGrantTrial,
  adminResolvePayment,
  adminSearchUsers,
  adminToggleUser,
  adminGetPromos,
  adminCreatePromo,
  adminDeletePromo,
} from '../api/client';
import type { AdminPromoCode } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../context/ToastContext';
import type {
  AdminUser,
  AdminUserDetail,
  PendingPaymentAdmin,
  UserProfile,
} from '../types';
import {
  ArrowLeft,
  Search,
  UserCheck,
  UserX,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Server,
  Plus,
  Zap,
  Trash2,
  Gift,
  Ticket,
  Percent,
  Loader2,
} from 'lucide-react';

interface AdminPageProps {
  navigate: (page: Page) => void;
  profile: UserProfile | null;
}

export function AdminPage({ navigate, profile }: AdminPageProps) {
  const { haptic, showBackButton, hideBackButton } = useTelegram();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'users' | 'payments' | 'promos'>('users');

  // Users tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);

  // Payments tab state
  const [pendings, setPendings] = useState<PendingPaymentAdmin[]>([]);
  const [loadingPendings, setLoadingPendings] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Promos tab state
  const [promos, setPromos] = useState<AdminPromoCode[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<'days' | 'percent'>('days');
  const [newPromoVal, setNewPromoVal] = useState(2);
  const [newPromoLimit, setNewPromoLimit] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);

  // Modal / Inputs state
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [selectedInboundId, setSelectedInboundId] = useState<number | null>(null);
  const [customInboundInput, setCustomInboundInput] = useState('');
  const [assigningInbound, setAssigningInbound] = useState(false);

  useEffect(() => {
    showBackButton(() => {
      if (selectedUser) {
        setSelectedUser(null);
      } else {
        navigate('home');
      }
    });
    return () => hideBackButton();
  }, [navigate, selectedUser, showBackButton, hideBackButton]);

  // Load initial users or search
  const handleSearch = useCallback(async (query: string) => {
    setLoadingUsers(true);
    try {
      const res = await adminSearchUsers(query);
      setUsers(res.users);
    } catch (err: any) {
      showToast(err.message || 'Ошибка поиска', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === 'users') {
      handleSearch(searchQuery);
    }
  }, [tab, searchQuery, handleSearch]);

  // Load pending payments
  const loadPendings = useCallback(async () => {
    setLoadingPendings(true);
    try {
      const res = await adminGetPendingPayments();
      setPendings(res.pending);
    } catch (err: any) {
      showToast(err.message || 'Ошибка загрузки заявок', 'error');
    } finally {
      setLoadingPendings(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === 'payments') {
      loadPendings();
    }
  }, [tab, loadPendings]);

  // View user details
  const handleSelectUser = async (tgId: number) => {
    haptic('light');
    try {
      const data = await adminGetUser(tgId);
      setSelectedUser(data);
    } catch (err: any) {
      showToast(err.message || 'Не удалось загрузить пользователя', 'error');
    }
  };

  // Extend subscription
  const handleExtend = async (days: number) => {
    if (!selectedUser) return;
    haptic('medium');
    try {
      const res = await adminExtendUser(selectedUser.user.tg_id, days);
      showToast(`Продлено на ${days} дн.! До: ${new Date(res.period_end).toLocaleDateString()}`, 'success');
      // Refresh user details
      handleSelectUser(selectedUser.user.tg_id);
    } catch (err: any) {
      showToast(err.message || 'Ошибка продления', 'error');
    }
  };

  // Grant trial to user
  const handleGrantTrial = async () => {
    if (!selectedUser) return;
    haptic('medium');
    try {
      const res = await adminGrantTrial(selectedUser.user.tg_id);
      showToast(`Пробный период успешно выдан! До: ${new Date(res.period_end).toLocaleDateString()}`, 'success');
      handleSelectUser(selectedUser.user.tg_id);
    } catch (err: any) {
      showToast(err.message || 'Ошибка выдачи теста', 'error');
    }
  };

  // Toggle user active status
  const handleToggle = async () => {
    if (!selectedUser) return;
    haptic('medium');
    try {
      const res = await adminToggleUser(selectedUser.user.tg_id);
      showToast(res.disabled ? 'Доступ отключен' : 'Доступ включен', 'success');
      handleSelectUser(selectedUser.user.tg_id);
    } catch (err: any) {
      showToast(err.message || 'Ошибка изменения статуса', 'error');
    }
  };

  // Delete user subscription
  const handleDeleteSub = async () => {
    if (!selectedUser) return;
    if (!window.confirm('Вы уверены, что хотите полностью удалить подписку этого пользователя?')) return;
    haptic('heavy');
    try {
      await adminDeleteSubscription(selectedUser.user.tg_id);
      showToast('Подписка пользователя успешно удалена', 'success');
      handleSelectUser(selectedUser.user.tg_id);
    } catch (err: any) {
      showToast(err.message || 'Ошибка удаления подписки', 'error');
    }
  };

  // Delete user completely
  const handleDeleteUserCompletely = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Вы уверены, что хотите ПОЛНОСТЬЮ удалить клиента ID ${selectedUser.user.tg_id} и ВСЕ его подписки/данные?`)) return;
    haptic('heavy');
    try {
      await adminDeleteUserCompletely(selectedUser.user.tg_id);
      showToast('Пользователь полностью удален из БД и 3x-ui', 'success');
      setSelectedUser(null);
      handleSearch(searchQuery);
    } catch (err: any) {
      showToast(err.message || 'Ошибка удаления пользователя', 'error');
    }
  };

  // Load promos
  const loadPromos = useCallback(async () => {
    setLoadingPromos(true);
    try {
      const data = await adminGetPromos();
      setPromos(data.promos);
    } catch (err: any) {
      showToast(err.message || 'Ошибка загрузки промокодов', 'error');
    } finally {
      setLoadingPromos(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === 'promos') {
      loadPromos();
    }
  }, [tab, loadPromos]);

  // Create promo
  const handleCreatePromo = async () => {
    if (!newPromoCode.trim()) {
      showToast('Введите название промокода', 'error');
      return;
    }
    haptic('medium');
    setCreatingPromo(true);
    try {
      await adminCreatePromo({
        code: newPromoCode.trim(),
        discount_percent: newPromoType === 'percent' ? newPromoVal : 0,
        bonus_days: newPromoType === 'days' ? newPromoVal : 0,
        uses_left: newPromoLimit.trim() ? parseInt(newPromoLimit.trim(), 10) : null,
      });
      showToast('Промокод успешно создан!', 'success');
      setNewPromoCode('');
      setNewPromoLimit('');
      loadPromos();
    } catch (err: any) {
      showToast(err.message || 'Ошибка создания промокода', 'error');
    } finally {
      setCreatingPromo(false);
    }
  };

  // Delete promo
  const handleDeletePromo = async (promoId: number, code: string) => {
    if (!window.confirm(`Удалить промокод ${code}?`)) return;
    haptic('heavy');
    try {
      await adminDeletePromo(promoId);
      showToast(`Промокод ${code} удален`, 'success');
      loadPromos();
    } catch (err: any) {
      showToast(err.message || 'Ошибка удаления промокода', 'error');
    }
  };

  // Assign 3x-ui inbound
  const handleAssignInbound = async () => {
    if (!selectedUser) return;
    const targetInboundId = customInboundInput.trim()
      ? parseInt(customInboundInput.trim(), 10)
      : selectedInboundId;

    if (!targetInboundId || isNaN(targetInboundId)) {
      showToast('Выберите инбаунд или введите его ID', 'error');
      return;
    }

    haptic('medium');
    setAssigningInbound(true);
    try {
      await adminAddInbound(selectedUser.user.tg_id, targetInboundId);
      showToast(`Инбаунд #${targetInboundId} успешно привязан!`, 'success');
      setShowInboundModal(false);
      setSelectedInboundId(null);
      setCustomInboundInput('');
      handleSelectUser(selectedUser.user.tg_id);
    } catch (err: any) {
      showToast(err.message || 'Ошибка привязки инбаунда', 'error');
    } finally {
      setAssigningInbound(false);
    }
  };

  // Resolve pending payment
  const handleResolvePayment = async (pendingId: number, action: 'confirm' | 'reject') => {
    haptic('medium');
    setActionLoading(pendingId);
    try {
      await adminResolvePayment(pendingId, action);
      showToast(action === 'confirm' ? 'Оплата подтверждена!' : 'Заявка отклонена', action === 'confirm' ? 'success' : 'error');
      loadPendings();
    } catch (err: any) {
      showToast(err.message || 'Ошибка обработки заявки', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: 'var(--danger)', marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff', marginBottom: 6 }}>Доступ запрещен</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Вы не являетесь администратором</div>
        <button className="btn btn-primary" onClick={() => navigate('home')}>Вернуться на главную</button>
      </div>
    );
  }

  // Format bytes helper
  const formatGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          className="noir-icon-btn"
          onClick={() => {
            if (selectedUser) {
              setSelectedUser(null);
            } else {
              navigate('home');
            }
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 850, color: '#ffffff' }}>Админ-панель 3X-UI</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Управление подписками v3.5.0</div>
        </div>
      </div>

      {/* Tabs */}
      {!selectedUser && (
        <div className="noir-pills-scroll" style={{ marginBottom: 16 }}>
          <button
            className={`noir-pill ${tab === 'users' ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setTab('users');
            }}
          >
            <Server size={14} />
            <span>Клиенты</span>
            <span className="noir-pill-badge">{users.length}</span>
          </button>

          <button
            className={`noir-pill ${tab === 'payments' ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setTab('payments');
            }}
          >
            <Clock size={14} />
            <span>Заявки на оплату</span>
            {pendings.length > 0 && <span className="noir-pill-badge" style={{ background: 'var(--danger)', color: '#ffffff' }}>{pendings.length}</span>}
          </button>

          <button
            className={`noir-pill ${tab === 'promos' ? 'active' : ''}`}
            onClick={() => {
              haptic('light');
              setTab('promos');
            }}
          >
            <Ticket size={14} />
            <span>Промокоды</span>
            <span className="noir-pill-badge">{promos.length}</span>
          </button>
        </div>
      )}

      {/* Selected User Details View */}
      {selectedUser ? (
        <div>
          <div className="card card-accent" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 850, color: '#ffffff' }}>
                  {selectedUser.user.username ? `@${selectedUser.user.username}` : 'Без юзернейма'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  TG ID: <code style={{ fontFamily: 'JetBrains Mono', color: '#ffffff' }}>{selectedUser.user.tg_id}</code>
                </div>
              </div>
              <span className={`noir-badge ${selectedUser.subscription?.disabled ? 'noir-badge-dark' : ''}`} style={{ background: selectedUser.subscription?.disabled ? 'var(--danger)' : 'var(--success)', color: '#ffffff' }}>
                {selectedUser.subscription?.disabled ? 'ОТКЛЮЧЕН' : selectedUser.subscription?.active ? 'АКТИВЕН' : 'ИСТЕК'}
              </span>
            </div>

            {selectedUser.subscription ? (
              <>
                <div className="info-row">
                  <span className="label">Тариф</span>
                  <span className="value">{selectedUser.subscription.plan_title}</span>
                </div>

                <div className="info-row">
                  <span className="label">Истекает</span>
                  <span className="value" style={{ fontFamily: 'JetBrains Mono' }}>
                    {new Date(selectedUser.subscription.period_end).toLocaleString()}
                  </span>
                </div>

                <div className="info-row">
                  <span className="label">Трафик (Скачано/Загружено)</span>
                  <span className="value">
                    {formatGB(selectedUser.traffic.download)} GB / {formatGB(selectedUser.traffic.upload)} GB
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 0' }}>
                У пользователя нет активной подписки
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="noir-section-title">УПРАВЛЕНИЕ ПОДПИСКОЙ</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-secondary btn-block" style={{ padding: '10px 6px', fontSize: 12 }} onClick={handleGrantTrial}>
              <Gift size={14} /> Тест
            </button>
            <button className="btn btn-secondary btn-block" style={{ padding: '10px 6px', fontSize: 12 }} onClick={() => handleExtend(7)}>
              <Plus size={14} /> +7 Дней
            </button>
            <button className="btn btn-secondary btn-block" style={{ padding: '10px 6px', fontSize: 12 }} onClick={() => handleExtend(30)}>
              <Plus size={14} /> +30 Дней
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            <button
              className="btn btn-block"
              style={{ background: selectedUser.subscription?.disabled ? 'var(--success)' : 'rgba(255, 255, 255, 0.08)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)' }}
              onClick={handleToggle}
            >
              {selectedUser.subscription?.disabled ? <UserCheck size={16} /> : <UserX size={16} />}
              <span>{selectedUser.subscription?.disabled ? 'Включить' : 'Отключить'}</span>
            </button>

            <button
              className="btn btn-block"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
              onClick={handleDeleteSub}
              disabled={!selectedUser.subscription}
            >
              <Trash2 size={16} />
              <span>Подписку</span>
            </button>
          </div>

          <button
            className="btn btn-block"
            style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#ff4d4d', border: '1px solid #ff4d4d', marginBottom: 16 }}
            onClick={handleDeleteUserCompletely}
          >
            <Trash2 size={16} />
            <span>🗑 Удалить пользователя полностью из БД</span>
          </button>

          {/* Inbounds list */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 750, color: '#ffffff' }}>Привязанные Инбаунды (3X-UI)</div>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowInboundModal(true)}>
                <Plus size={12} /> Добавить
              </button>
            </div>

            {selectedUser.inbounds && selectedUser.inbounds.length > 0 ? (
              selectedUser.inbounds.map((ib) => (
                <div key={ib.id} style={{ padding: '8px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 10, marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <div>
                    <span style={{ fontWeight: 800, color: '#ffffff' }}>#{ib.id} {ib.remark}</span>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Порт: {ib.port} · Протокол: {ib.protocol}</div>
                  </div>
                  <span className="noir-badge noir-badge-dark">v3.5.0</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Нет доступных инбаундов</div>
            )}
          </div>

          {/* Modal for selecting or typing inbound */}
          {showInboundModal && (
            <div className="card card-accent" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 850, color: '#ffffff', marginBottom: 12 }}>Привязать новый инбаунд (3X-UI)</div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Выберите из списка панели или введите ID вручную:
              </div>

              {selectedUser.inbounds && selectedUser.inbounds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {selectedUser.inbounds.map((ib) => {
                    const isSelected = selectedInboundId === ib.id && !customInboundInput;
                    return (
                      <button
                        key={ib.id}
                        type="button"
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-block`}
                        style={{ justifyContent: 'space-between', padding: '10px 14px' }}
                        onClick={() => {
                          setSelectedInboundId(ib.id);
                          setCustomInboundInput('');
                        }}
                      >
                        <span>#{ib.id} {ib.remark} ({ib.protocol})</span>
                        <Zap size={14} />
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <input
                  type="number"
                  placeholder="Или введите ID инбаунда (напр. 1, 2)..."
                  value={customInboundInput}
                  onChange={(e) => {
                    setCustomInboundInput(e.target.value);
                    setSelectedInboundId(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={handleAssignInbound}
                  disabled={assigningInbound || (!selectedInboundId && !customInboundInput.trim())}
                >
                  {assigningInbound ? 'Привязка...' : 'Привязать'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => {
                    setShowInboundModal(false);
                    setSelectedInboundId(null);
                    setCustomInboundInput('');
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'users' ? (
        /* Users Search List */
        <div>
          <div className="card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по TG ID или @username..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {loadingUsers ? (
            <div className="skeleton" style={{ height: 80, marginBottom: 10 }} />
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="title">Пользователи не найдены</div>
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.tg_id}
                className="card card-interactive"
                style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => handleSelectUser(u.tg_id)}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                    {u.username ? `@${u.username}` : `ID: ${u.tg_id}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    ID: {u.tg_id} {u.subscription ? `· ${u.subscription.plan_title}` : '· Без подписки'}
                  </div>
                </div>

                <span className={`noir-badge ${u.subscription?.disabled ? 'noir-badge-dark' : ''}`} style={{ background: u.subscription?.disabled ? 'var(--danger)' : u.subscription?.active ? 'var(--success)' : 'rgba(255, 255, 255, 0.1)', color: '#ffffff' }}>
                  {u.subscription?.disabled ? 'ОТКЛЮЧЕН' : u.subscription?.active ? 'АКТИВЕН' : 'НЕТ'}
                </span>
              </div>
            ))
          )}
        </div>
      ) : tab === 'payments' ? (
        /* Pending Payments List */
        <div>
          <div className="noir-section-title">ОЖИДАЮЩИЕ ОПЛАТЫ</div>

          {loadingPendings ? (
            <div className="skeleton" style={{ height: 100, marginBottom: 10 }} />
          ) : pendings.length === 0 ? (
            <div className="empty-state">
              <div className="title">Нет ожидающих заявок</div>
            </div>
          ) : (
            pendings.map((p) => (
              <div key={p.id} className="card card-accent" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 850, color: '#ffffff' }}>
                      {p.username ? `@${p.username}` : `ID: ${p.user_tg_id}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Заказ: <code style={{ fontFamily: 'JetBrains Mono', color: '#ffffff' }}>{p.order_code}</code>
                    </div>
                  </div>
                  <span className="noir-badge" style={{ background: '#ffffff', color: '#000000' }}>
                    {p.amount_rub} ₽
                  </span>
                </div>

                <div className="info-row">
                  <span className="label">Тариф</span>
                  <span className="value">{p.plan_title}</span>
                </div>

                <div className="info-row" style={{ marginBottom: 12 }}>
                  <span className="label">Способ</span>
                  <span className="value">{p.method_title}</span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-block"
                    style={{ background: 'var(--success)', color: '#ffffff' }}
                    disabled={actionLoading === p.id}
                    onClick={() => handleResolvePayment(p.id, 'confirm')}
                  >
                    <CheckCircle2 size={16} /> Подтвердить
                  </button>
                  <button
                    className="btn btn-block"
                    style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                    disabled={actionLoading === p.id}
                    onClick={() => handleResolvePayment(p.id, 'reject')}
                  >
                    <XCircle size={16} /> Отклонить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Promos Management List & Form */
        <div>
          <div className="noir-section-title">СОЗДАТЬ ПРОМОКОД</div>

          <div className="card card-accent" style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 750, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                НАЗВАНИЕ ПРОМОКОДА (НАПР. WELCOME)
              </label>
              <input
                type="text"
                placeholder="Введите код (напр. WELCOME)..."
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#000000',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button
                type="button"
                className={`btn ${newPromoType === 'days' ? 'btn-primary' : 'btn-secondary'} btn-block`}
                style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                onClick={() => setNewPromoType('days')}
              >
                <Gift size={14} /> + Дни к подписке
              </button>

              <button
                type="button"
                className={`btn ${newPromoType === 'percent' ? 'btn-primary' : 'btn-secondary'} btn-block`}
                style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                onClick={() => setNewPromoType('percent')}
              >
                <Percent size={14} /> % Скидка
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 750, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  {newPromoType === 'days' ? 'КОЛ-ВО ДНЕЙ (НАПР. 2)' : 'СКИДКА В % (НАПР. 15)'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPromoVal}
                  onChange={(e) => setNewPromoVal(parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#000000',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 750, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  ЛИМИТ АКТИВАЦИЙ (ПУСТО = ♾️)
                </label>
                <input
                  type="number"
                  placeholder="Безлимит"
                  value={newPromoLimit}
                  onChange={(e) => setNewPromoLimit(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#000000',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              className="btn btn-primary btn-block"
              disabled={creatingPromo || !newPromoCode.trim()}
              onClick={handleCreatePromo}
            >
              {creatingPromo ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
              <span>Создать промокод</span>
            </button>
          </div>

          <div className="noir-section-title">СПИСОК ПРОМОКОДОВ ({promos.length})</div>

          {loadingPromos ? (
            <div className="skeleton" style={{ height: 100, marginBottom: 10 }} />
          ) : promos.length === 0 ? (
            <div className="empty-state">
              <div className="title">Промокоды не созданы</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {promos.map((p) => (
                <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <code style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>{p.code}</code>
                      <span className="noir-badge" style={{ background: p.bonus_days > 0 ? 'var(--success)' : 'var(--accent-purple)', color: '#ffffff' }}>
                        {p.bonus_days > 0 ? `+${p.bonus_days} ДНЕЙ` : `-${p.discount_percent}%`}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Использовано: <strong style={{ color: '#ffffff' }}>{p.uses_count} раз</strong> · Лимит: {p.uses_left !== null ? `${p.uses_left} шт.` : '♾️'}
                    </div>
                  </div>

                  <button
                    className="noir-icon-btn"
                    style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={() => handleDeletePromo(p.id, p.code)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
