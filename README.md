# Study Order

Sistema de caderno de estudos baseado na referência enviada, com o nome **Study Order**.

## Funcionalidades implementadas
- Autenticação por e-mail e senha via Supabase
- Cadastro de usuário
- Matérias personalizadas
- Exclusão de matéria
- Provas/tarefas com data
- Marcar tarefa como concluída
- Exclusão de tarefas
- Anotações por matéria com salvamento automático/manual no banco
- Links e vídeos por URL, abertos em nova aba
- Upload de arquivos/fotos armazenados como Base64 no Supabase
- Sincronização por conta
- Dashboard
- Modo claro/escuro
- Layout responsivo

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Cole e execute o conteúdo de `supabase.sql`.
4. Abra `config.js` e coloque:
   - Project URL
   - anon public key
5. Abra `index.html`.

### Importante sobre arquivos Base64
O projeto segue a especificação pedida e grava o arquivo em Base64 na tabela `files`.
Para produção, arquivos grandes devem preferencialmente usar o Supabase Storage, porque Base64 aumenta o tamanho dos dados e pode atingir limites do banco.

## Rodar localmente
Pode abrir `index.html` diretamente no navegador. Para um ambiente real, publique os arquivos em um servidor estático.

## Segurança
Nunca coloque a `service_role key` no frontend. Use somente a chave `anon public` com RLS habilitado.
