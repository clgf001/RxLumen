import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  ImportOutlined,
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  manualSchema,
  sections,
  type Manual,
  type ManualInput,
  type SearchResult,
} from '../../shared/manual';
import { api, json } from './api';

const { Text, Paragraph } = Typography;
const blank = {
  genericName: '',
  manufacturer: '',
  approvalNumber: '',
  status: 'draft',
  isDemo: false,
};
const fieldOptions = [
  { value: 'all', label: '全部字段' },
  { value: 'genericName', label: '名称 / 拼音' },
  { value: 'manufacturer', label: '生产厂家' },
  { value: 'approvalNumber', label: '批准文号' },
];
function label(item: Manual) {
  return (
    <Space size={5}>
      <Tag color={item.isDemo ? 'orange' : 'green'}>{item.isDemo ? '虚构演示' : '已录入资料'}</Tag>
      {item.status === 'draft' && <Tag>草稿</Tag>}
    </Space>
  );
}

export default function App() {
  const { message } = AntApp.useApp();
  const [admin, setAdmin] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [field, setField] = useState('all');
  const [demo, setDemo] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResult>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Manual>();
  const [editor, setEditor] = useState<{ item?: Manual }>();
  const [importing, setImporting] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    api<{ authenticated: boolean }>('/api/auth/me')
      .then((v) => setAuthenticated(v.authenticated))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const n = ++request.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      q: search,
      field,
      demo,
      page: String(page),
      pageSize: '12',
      scope: admin ? 'admin' : 'public',
    });
    api<SearchResult>(`/api/manuals?${params}`)
      .then((v) => {
        if (n !== request.current) return;
        if (page > 1 && !v.items.length) {
          setPage(1);
          return;
        }
        setData(v);
      })
      .catch((e) => {
        if (n === request.current) {
          setError(e.message);
          setData(undefined);
        }
      })
      .finally(() => {
        if (n === request.current) setLoading(false);
      });
  }, [search, field, demo, page, admin, revision]);
  function switchMode(next: boolean) {
    if (next && !authenticated) {
      setLogin(true);
      return;
    }
    setAdmin(next);
    setPage(1);
    setQ('');
    setSearch('');
    setDemo('all');
  }
  async function signIn() {
    setLoginBusy(true);
    setLoginError('');
    try {
      await api('/api/auth/login', json('POST', { password }));
      setAuthenticated(true);
      setLogin(false);
      setPassword('');
      setAdmin(true);
      setPage(1);
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setLoginBusy(false);
    }
  }
  async function signOut() {
    try {
      await api('/api/auth/logout', json('POST', {}));
      setAuthenticated(false);
      switchMode(false);
    } catch (e) {
      void message.error((e as Error).message);
    }
  }
  async function remove(item: Manual) {
    try {
      await api(`/api/admin/manuals/${item.id}`, json('DELETE', { version: item.version }));
      void message.success('说明书已删除');
      refresh();
    } catch (e) {
      void message.error((e as Error).message);
    }
  }
  async function openDetail(item: Manual) {
    try {
      setSelected(await api<Manual>(`/api/manuals/${item.id}`));
    } catch (e) {
      void message.error((e as Error).message);
      refresh();
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="RxLumen 首页">
          <span className="brand-icon">Rx</span>
          <span>
            RxLumen<small>药品说明书知识库</small>
          </span>
        </a>
        <div className="nav-caption">工作空间</div>
        <button className={`nav-item ${!admin ? 'active' : ''}`} onClick={() => switchMode(false)}>
          <SearchOutlined /> 说明书检索 <span>01</span>
        </button>
        <button className={`nav-item ${admin ? 'active' : ''}`} onClick={() => switchMode(true)}>
          <DatabaseOutlined /> 资料管理 <span>02</span>
        </button>
        <div className="sidebar-bottom">
          <SafetyCertificateOutlined />
          <strong>让每一份资料有据可查</strong>
          <p>保留来源 · 人工复核 · 结构化检索</p>
          <span className="version">MVP · v0.1.0</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            <span className="status-dot" /> 医院药品资料工作台
          </span>
          <Space>
            <Tag variant="filled">本地知识库</Tag>
            {authenticated ? (
              <Tooltip title="退出管理员登录">
                <Button
                  aria-label="退出登录"
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={() => void signOut()}
                />
              </Tooltip>
            ) : (
              <Button type="text" icon={<LockOutlined />} onClick={() => setLogin(true)}>
                管理登录
              </Button>
            )}
          </Space>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {admin ? 'LIBRARY MANAGEMENT' : 'DRUG INFORMATION LIBRARY'}
              </div>
              <h1>{admin ? '资料管理' : '查阅说明书，从这里开始。'}</h1>
              <p>
                {admin
                  ? '整理、复核并发布可追溯的药品资料。草稿仅管理员可见。'
                  : '集中检索药品资料，让信息更清晰，让查找更简单。'}
              </p>
            </div>
            <div className="heading-icon">
              <BookOutlined />
            </div>
          </div>
          <Alert
            className="safety-note"
            showIcon
            type="info"
            title="资料检索工具，不提供诊疗或用药建议"
            description="请以经核实的最新版正式说明书及专业人员判断为准。标记“虚构演示”的记录完全虚构，不可用于临床。"
          />
          <div className="summary-row">
            <div>
              <span className="summary-icon">
                <FileTextOutlined />
              </span>
              <span>
                <strong>{data?.totalPublished ?? '—'}</strong>
                <small>已发布资料</small>
              </span>
            </div>
            <div>
              <span className="summary-icon amber">
                <BookOutlined />
              </span>
              <span>
                <strong>{data ? data.totalPublished - data.demoCount : '—'}</strong>
                <small>正式资料</small>
              </span>
            </div>
            <div>
              <span className="summary-icon muted">
                <SafetyCertificateOutlined />
              </span>
              <span>
                <strong>{data?.demoCount ?? '—'}</strong>
                <small>虚构演示资料</small>
              </span>
            </div>
            <div className="summary-hint">
              <CheckCircleOutlined /> 来源与复核信息随条目展示
            </div>
          </div>
          <Card className="search-panel" variant="borderless">
            <label className="search-label" htmlFor="manual-search">
              {admin ? '查找已录入的资料' : '搜索药品说明书'}
            </label>
            <form
              className="search-controls"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(q.trim());
                setPage(1);
                refresh();
              }}
            >
              <Select
                aria-label="搜索字段"
                value={field}
                options={fieldOptions}
                onChange={(v) => {
                  setField(v);
                  setPage(1);
                }}
              />
              <Input
                id="manual-search"
                size="large"
                allowClear
                prefix={<SearchOutlined />}
                value={q}
                maxLength={100}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (!e.target.value) {
                    setSearch('');
                    setPage(1);
                  }
                }}
                placeholder="输入通用名、商品名、拼音、厂家或批准文号"
              />
              <Button size="large" type="primary" htmlType="submit" icon={<SearchOutlined />}>
                搜索资料
              </Button>
            </form>
            <div className="search-foot">
              <Text type="secondary">支持中文名称、全拼及拼音首字母</Text>
              <Segmented
                aria-label="数据类型筛选"
                size="small"
                value={demo}
                options={[
                  { label: '全部资料', value: 'all' },
                  { label: '正式资料', value: 'real' },
                  { label: '虚构演示', value: 'demo' },
                ]}
                onChange={(v) => {
                  setDemo(String(v));
                  setPage(1);
                }}
              />
            </div>
          </Card>
          <div className="results-heading">
            <h2>
              {admin ? '说明书目录' : search ? `“${search}”的搜索结果` : '说明书目录'}{' '}
              <span>{data?.total ?? 0}</span>
            </h2>
            <Space>
              {admin && (
                <>
                  <Button icon={<ImportOutlined />} onClick={() => setImporting(true)}>
                    导入 JSON
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({})}>
                    新增说明书
                  </Button>
                </>
              )}
              <Button aria-label="刷新列表" icon={<ReloadOutlined />} onClick={refresh} />
            </Space>
          </div>
          {error && (
            <Alert
              showIcon
              type="error"
              title="暂时无法加载资料"
              description={error}
              action={<Button onClick={refresh}>重试</Button>}
            />
          )}
          <Spin spinning={loading}>
            <div className="results-area">
              {!error && !data?.items.length && !loading ? (
                <div className="empty-panel">
                  <div className="empty-art">
                    <FileTextOutlined />
                    <span>
                      <SearchOutlined />
                    </span>
                  </div>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    styles={{ image: { display: 'none' } }}
                    description={
                      <>
                        <h3>
                          {search || demo !== 'all'
                            ? '没有找到匹配的说明书'
                            : '知识库已就绪，等待第一份资料'}
                        </h3>
                        <p>
                          {search || demo !== 'all'
                            ? '尝试缩短关键词、切换搜索字段或查看全部资料。'
                            : '请由管理员录入并复核正式说明书，或导入明确标识的虚构演示文件。'}
                        </p>
                      </>
                    }
                  />
                  <Button
                    type="primary"
                    icon={search || demo !== 'all' ? <CloseOutlined /> : <PlusOutlined />}
                    onClick={() => {
                      if (search || demo !== 'all') {
                        setQ('');
                        setSearch('');
                        setDemo('all');
                        setPage(1);
                      } else if (admin) setEditor({});
                      else switchMode(true);
                    }}
                  >
                    {search || demo !== 'all'
                      ? '清除筛选'
                      : admin
                        ? '新增第一份说明书'
                        : '前往资料管理'}
                  </Button>
                </div>
              ) : admin ? (
                <Table<Manual>
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: 850 }}
                  dataSource={data?.items || []}
                  columns={[
                    {
                      title: '药品名称',
                      dataIndex: 'genericName',
                      render: (_, item) => (
                        <>
                          <Button
                            type="link"
                            className="table-title"
                            onClick={() => void openDetail(item)}
                          >
                            {item.genericName}
                          </Button>
                          <div>{label(item)}</div>
                        </>
                      ),
                    },
                    { title: '生产厂家', dataIndex: 'manufacturer' },
                    { title: '批准文号 / 演示编号', dataIndex: 'approvalNumber' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (v) => (
                        <Tag color={v === 'published' ? 'green' : 'default'}>
                          {v === 'published' ? '已发布' : '草稿'}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      render: (_, item) => (
                        <Space>
                          <Button size="small" onClick={() => setEditor({ item })}>
                            编辑
                          </Button>
                          <Popconfirm
                            title="删除这份说明书？"
                            description="删除后无法从界面恢复，请确认已备份。"
                            onConfirm={() => remove(item)}
                            okText="删除"
                            cancelText="取消"
                          >
                            <Button size="small" danger>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
              ) : (
                <div className="manual-grid">
                  {data?.items.map((item) => (
                    <button
                      key={item.id}
                      className="manual-card"
                      onClick={() => void openDetail(item)}
                    >
                      <div className="card-top">
                        <span className="doc-icon">
                          <FileTextOutlined />
                        </span>
                        {label(item)}
                      </div>
                      <h3>{item.genericName}</h3>
                      <p className="trade-name">
                        {item.tradeName || '未记录商品名'}
                        {item.specification && ` · ${item.specification}`}
                      </p>
                      <dl>
                        <dt>生产厂家</dt>
                        <dd>{item.manufacturer}</dd>
                        <dt>{item.isDemo ? '演示编号' : '批准文号'}</dt>
                        <dd>{item.approvalNumber}</dd>
                      </dl>
                      <div className="card-bottom">
                        <span>
                          {item.isDemo
                            ? '虚构占位 · 不可用于临床'
                            : `复核日期 ${item.reviewedAt || '未记录'}`}
                        </span>
                        <ArrowRightOutlined />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Spin>
          {!!data?.total && (
            <div className="pagination">
              <Pagination
                current={page}
                pageSize={12}
                total={data.total}
                showSizeChanger={false}
                onChange={setPage}
                showTotal={(n) => `共 ${n} 份资料`}
              />
            </div>
          )}
          <footer>
            <span>RxLumen · 药品说明书检索系统</span>
            <span>
              AGPL-3.0 · 无担保 · 不含 AI 问答 ·{' '}
              <a
                href="https://github.com/clgf001/RxLumen"
                target="_blank"
                rel="noopener noreferrer"
              >
                源码与许可 ↗
              </a>
            </span>
          </footer>
        </div>
      </main>
      <Modal
        title="登录资料管理"
        open={login}
        onCancel={() => {
          setLogin(false);
          setPassword('');
          setLoginError('');
        }}
        onOk={() => void signIn()}
        okText="登录"
        cancelText="取消"
        confirmLoading={loginBusy}
      >
        <p>请输入部署时设置的管理员密码。登录有效期为 8 小时，服务重启后需重新登录。</p>
        <Input.Password
          aria-label="管理员密码"
          placeholder="管理员密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={() => void signIn()}
        />
        {loginError && <Alert type="error" showIcon title={loginError} style={{ marginTop: 16 }} />}
      </Modal>
      <Drawer
        title="说明书详情"
        size="large"
        open={!!selected}
        onClose={() => setSelected(undefined)}
      >
        {selected && <Detail item={selected} />}
      </Drawer>
      {editor && (
        <Editor
          item={editor.item}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined);
            refresh();
          }}
        />
      )}
      {importing && (
        <Importer
          onClose={() => setImporting(false)}
          onSaved={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Detail({ item }: { item: Manual }) {
  return (
    <div className="detail">
      {label(item)}
      <h1>{item.genericName}</h1>
      <Paragraph type="secondary">{item.tradeName || '未记录商品名'}</Paragraph>
      {item.isDemo && (
        <Alert
          showIcon
          type="warning"
          title="完全虚构的演示数据"
          description="以下内容仅用于展示页面结构，不对应真实药品，不可用于任何临床或用药决策。"
        />
      )}
      <Descriptions
        column={1}
        size="small"
        style={{ marginTop: 24 }}
        items={[
          { key: 'manufacturer', label: '生产厂家', children: item.manufacturer },
          {
            key: 'approval',
            label: item.isDemo ? '演示编号' : '批准文号',
            children: item.approvalNumber,
          },
          {
            key: 'spec',
            label: '规格 / 剂型',
            children: `${item.specification || '未记录'} / ${item.dosageForm || '未记录'}`,
          },
        ]}
      />
      <nav className="section-nav">
        {sections.map(([key, title]) => (
          <a key={key} href={`#section-${key}`}>
            {title}
          </a>
        ))}
      </nav>
      {sections.map(([key, title]) => (
        <section className="manual-section" id={`section-${key}`} key={key}>
          <h2>{title}</h2>
          <p>{item[key] || '未录入；不代表无相关风险，请核对正式说明书。'}</p>
        </section>
      ))}
      <section className="source-box">
        <h2>信息来源与复核</h2>
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'source', label: '来源', children: item.sourceName || '未记录' },
            {
              key: 'url',
              label: '原始链接',
              children: item.sourceUrl ? (
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                  查看来源 ↗
                </a>
              ) : (
                '未记录'
              ),
            },
            { key: 'revision', label: '说明书修订日期', children: item.revisionDate || '未记录' },
            {
              key: 'review',
              label: '复核人 / 日期',
              children: `${item.reviewedBy || '未记录'} / ${item.reviewedAt || '未记录'}`,
            },
            {
              key: 'version',
              label: '系统记录版本',
              children: `v${item.version} · 更新于 ${new Date(item.updatedAt).toLocaleString('zh-CN')}`,
            },
          ]}
        />
        <Text type="secondary">系统仅记录人工填写的来源及复核信息，不自动验证资料真实性。</Text>
      </section>
    </div>
  );
}

function Editor({
  item,
  onClose,
  onSaved,
}: {
  item?: Manual;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<ManualInput>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('base');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { message } = AntApp.useApp();
  async function save() {
    setError('');
    setValidationErrors([]);
    const raw = form.getFieldsValue(true) as Record<string, unknown>;
    const input = Object.fromEntries(Object.keys(manualSchema.shape).map((k) => [k, raw[k]]));
    const parsed = manualSchema.safeParse(input);
    if (!parsed.success) {
      setValidationErrors(
        parsed.error.issues.map((v) => `${v.path.join('.') || '记录'}：${v.message}`),
      );
      return;
    }
    setBusy(true);
    try {
      await api(
        item ? `/api/admin/manuals/${item.id}` : '/api/admin/manuals',
        json(
          item ? 'PUT' : 'POST',
          item ? { version: item.version, data: parsed.data } : parsed.data,
        ),
      );
      void message.success('说明书已保存');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (name: string, title: string, required = false, placeholder?: string) => (
    <Form.Item name={name} label={title} required={required}>
      <Input
        maxLength={name === 'sourceUrl' ? 2000 : name === 'approvalNumber' ? 100 : 200}
        placeholder={placeholder}
      />
    </Form.Item>
  );
  return (
    <Modal
      width={880}
      title={item ? '编辑说明书' : '新增说明书'}
      open
      onCancel={onClose}
      onOk={() => void save()}
      okText="保存资料"
      cancelText="取消"
      confirmLoading={busy}
      mask={{ closable: false }}
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto', paddingRight: 6 } }}
    >
      <Alert
        type="info"
        showIcon
        title="先保存草稿，复核后再发布"
        description="正式发布需要信息来源、复核记录和关键说明书栏目。演示数据须勾选标识，名称以【虚构演示】开头，编号以 DEMO- 开头。"
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" initialValues={item || blank}>
        <div className="form-status">
          <Form.Item name="status" label="发布状态">
            <Select
              options={[
                { value: 'draft', label: '草稿（仅管理员可见）' },
                { value: 'published', label: '发布到检索页' },
              ]}
            />
          </Form.Item>
          <Form.Item name="isDemo" label="虚构演示数据" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </div>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'base',
              label: '基本信息',
              forceRender: true,
              children: (
                <div className="form-grid">
                  {field('genericName', '药品通用名', true)}
                  {field('tradeName', '商品名')}
                  {field('manufacturer', '生产厂家', true)}
                  {field('approvalNumber', '批准文号 / 演示编号', true)}
                  {field('specification', '规格')}
                  {field('dosageForm', '剂型')}
                </div>
              ),
            },
            {
              key: 'body',
              label: '说明书内容',
              forceRender: true,
              children: (
                <>
                  {sections.map(([key, title]) => (
                    <Form.Item key={key} name={key} label={title}>
                      <Input.TextArea
                        autoSize={{ minRows: 3, maxRows: 10 }}
                        maxLength={12000}
                        showCount
                        placeholder="按正式说明书原文录入；请勿推断或编造缺失内容"
                      />
                    </Form.Item>
                  ))}
                </>
              ),
            },
            {
              key: 'source',
              label: '来源与复核',
              forceRender: true,
              children: (
                <>
                  {field('sourceName', '信息来源名称')}
                  {field('sourceUrl', '原始来源链接', false, 'https://…')}
                  <div className="form-grid">
                    {field('revisionDate', '说明书修订日期', false, 'YYYY-MM-DD')}
                    {field('reviewedBy', '复核人')}
                    {field('reviewedAt', '复核日期', false, 'YYYY-MM-DD')}
                  </div>
                  <Paragraph type="secondary">
                    日期为
                    YYYY-MM-DD。来源可为监管机构或厂家发布的正式说明书、已授权资料或院内核验纸质原件；请确认录入及使用权。
                  </Paragraph>
                </>
              ),
            },
          ]}
        />
      </Form>
      {(error || validationErrors.length > 0) && (
        <Alert
          type="error"
          showIcon
          title="未能保存"
          description={<div className="error-lines">{error || validationErrors.join('\n')}</div>}
        />
      )}
    </Modal>
  );
}

function Importer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [content, setContent] = useState('');
  const [count, setCount] = useState<number>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { message } = AntApp.useApp();
  async function run(dryRun: boolean) {
    setBusy(true);
    setError('');
    try {
      if (new Blob([content]).size > 1_900_000) throw new Error('文件过大，请拆分到 1.9 MB 以内');
      const items: unknown = JSON.parse(content);
      if (!Array.isArray(items)) throw new Error('文件顶层必须为 JSON 数组');
      const result = await api<{ count: number }>(
        '/api/admin/import',
        json('POST', { items, dryRun }),
      );
      if (dryRun) setCount(result.count);
      else {
        void message.success(`已导入 ${result.count} 份资料`);
        onSaved();
      }
    } catch (e) {
      setCount(undefined);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      width={760}
      title="批量导入说明书"
      open
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button loading={busy} onClick={() => void run(true)}>
            校验数据
          </Button>
          <Button
            type="primary"
            disabled={count === undefined}
            loading={busy}
            onClick={() => void run(false)}
          >
            确认导入 {count ?? ''} 条
          </Button>
        </Space>
      }
    >
      <Alert
        showIcon
        type="info"
        title="仅支持新增，不会覆盖已有资料"
        description="每批最多 200 条、请求不超过 2 MB。批准文号全库唯一；任何错误都会拒绝整批导入。先校验，再确认。"
      />
      <p>
        <a href="/import-example.json" download>
          下载虚构演示 JSON 样例
        </a>{' '}
        <Text type="secondary">· 内容完全虚构，绝非真实药品资料</Text>
      </p>
      <label className="file-input">
        选择 UTF-8 JSON 文件{' '}
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setCount(undefined);
            setError('');
            if (file.size > 1_900_000) {
              setError('文件过大，请拆分到 1.9 MB 以内');
              return;
            }
            try {
              setContent(await file.text());
            } catch {
              setError('无法读取文件，请重新选择');
            }
          }}
        />
      </label>
      <Input.TextArea
        aria-label="导入 JSON 内容"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setCount(undefined);
          setError('');
        }}
        rows={12}
        placeholder="或在这里粘贴 JSON 数组"
        style={{ marginTop: 16, fontFamily: 'monospace' }}
      />
      {count !== undefined && (
        <Alert
          type="success"
          showIcon
          title={`校验通过：${count} 条资料。尚未写入数据库。`}
          style={{ marginTop: 16 }}
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          title="未能确认导入结果"
          description={<div className="error-lines">{error}</div>}
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  );
}
