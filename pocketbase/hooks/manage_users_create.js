routerAdd(
  'POST',
  '/backend/v1/users/create',
  (e) => {
    const body = e.requestInfo().body || {}
    const name = String(body.name || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const password = String(body.password || '')

    if (!name) {
      return e.badRequestError('O nome é obrigatório.')
    }
    if (!email || !email.includes('@')) {
      return e.badRequestError('E-mail válido é obrigatório.')
    }
    if (!password || password.length < 8) {
      return e.badRequestError('A senha deve ter pelo menos 8 caracteres.')
    }

    // Verificar se já existe usuário com este e-mail
    try {
      const existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', email)
      if (existingUser) {
        return e.badRequestError('Já existe um usuário cadastrado com este e-mail.')
      }
    } catch (_) {}

    // Cria o usuário na coleção users e o perfil na coleção profiles
    let createdProfileId = ''
    let createdUserId = ''

    try {
      $app.runInTransaction((txApp) => {
        const usersCol = txApp.findCollectionByNameOrId('_pb_users_auth_')
        const userRec = new Record(usersCol)
        userRec.setEmail(email)
        userRec.setPassword(password)
        userRec.setVerified(true)
        userRec.set('name', name)
        txApp.save(userRec)
        createdUserId = userRec.id

        const profilesCol = txApp.findCollectionByNameOrId('profiles')
        const profileRec = new Record(profilesCol)
        profileRec.set('user', userRec.id)
        profileRec.set('name', name)
        profileRec.set('email', email)
        profileRec.set('active', true)
        txApp.save(profileRec)
        createdProfileId = profileRec.id
      })
    } catch (err) {
      return e.badRequestError('Não foi possível criar o usuário: ' + err.message)
    }

    // Retorna o perfil criado
    const createdProfile = $app.findFirstRecordByData('profiles', 'id', createdProfileId)

    return e.json(200, {
      id: createdProfile.id,
      user: createdUserId,
      name: createdProfile.getString('name'),
      email: createdProfile.getString('email'),
      active: createdProfile.getBool('active'),
      created: createdProfile.getString('created'),
      updated: createdProfile.getString('updated'),
    })
  },
  $apis.requireAuth(),
)
