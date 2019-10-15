FROM node:10
ARG index_file

RUN apt-get update &&\
  apt-get upgrade -yy &&\
  apt-get install -yy python-pip bash-completion curl git nano wget make net-tools netcat dnsutils libpng-dev

RUN echo ". /usr/share/bash-completion/bash_completion" >> ~/.bashrc

WORKDIR /app
ADD ./package.json /app
RUN npm i

ADD . /app
EXPOSE 3005
