docker build -t my-backend-image -f backend/Dockerfile-backend ./backend
docker run -d -p 5000:5000 --name backend-container my-backend-image

docker build -t mongodb-image -f database/Dockerfile-db ./Database
docker run -d -p 27017:27017 --name mongocontainer7 -v ./Database:/data/db mongodb-image