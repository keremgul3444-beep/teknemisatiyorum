-- İlk kurulumda ölçüm (Umami) için ayrı veritabanı. Var olan kurulumda: docker compose -f deploy/docker-compose.yml exec db createdb -U tms umami
CREATE DATABASE umami;
