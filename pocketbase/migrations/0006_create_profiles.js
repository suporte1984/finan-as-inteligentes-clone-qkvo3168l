migrate(
  (app) => {
    // Permite que qualquer usuário autenticado leia, crie e atualize perfis
    // Isso atende o requisito de multi-usuário simples sem cargos separados no momento.
    const authRule = "@request.auth.id != ''"

    const profiles = new Collection({
      name: 'profiles',
      type: 'base',
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true, min: 1, max: 150 },
        { name: 'email', type: 'email', required: true },
        // bool flags devem ser opcionais (required em bool exige true no PB)
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_profiles_user ON profiles (user)',
        'CREATE INDEX idx_profiles_email ON profiles (email)',
        'CREATE INDEX idx_profiles_active ON profiles (active)',
      ],
    })
    app.save(profiles)

    // Seed: criar profile para usuários existentes (como Paulo Gabriel) se ainda não tiverem
    const users = app.findRecordsByFilter('users', '', '-created', 100, 0)
    for (let i = 0; i < users.length; i++) {
      const u = users[i]
      try {
        app.findFirstRecordByData('profiles', 'user', u.id)
      } catch (_) {
        const p = new Record(profiles)
        p.set('user', u.id)
        p.set('name', u.getString('name') || u.getString('email') || 'Usuário')
        p.set('email', u.getString('email'))
        p.set('active', true)
        app.save(p)
      }
    }
  },
  (app) => {
    try {
      const profiles = app.findCollectionByNameOrId('profiles')
      app.delete(profiles)
    } catch (_) {}
  },
)
