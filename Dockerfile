# FROM helixious86/ubuntu_base_image:latest
# FROM helixious86/eos_base_image:centos7.v1.1.1
# FROM eostudio/eosio.cdt:v1.7.0
FROM scratch
ADD centos-7-x86_64-docker.tar.xz /

LABEL \
    org.label-schema.schema-version="1.0" \
    org.label-schema.name="CentOS Base Image" \
    org.label-schema.vendor="CentOS" \
    org.label-schema.license="GPLv2" \
    org.label-schema.build-date="20200504" \
    org.opencontainers.image.title="CentOS Base Image" \
    org.opencontainers.image.vendor="CentOS" \
    org.opencontainers.image.licenses="GPL-2.0-only" \
    org.opencontainers.image.created="2020-05-04 00:00:00+01:00"


USER root
# ARG cdt_release=v1.6.3
# ARG eos_release=latest
# ARG contract_release=release/1.8.x
# shubert
# March 20th
# RUN yum update -y \    
#     && curl -sL https://rpm.nodesource.com/setup_14.x | bash - \
#     && yum install -y nodejs \
#     && yum clean all && yum makecache fast

# RUN rm -rf install_deb.sh anaconda-post.log
RUN yum install -y epel-release && yum update -y && yum upgrade -y
RUN yum install -y make git wget aptitude curl gcc gcc-c++ apt-utils clang

ADD bios.js /
ADD init.sh /
RUN chmod +x /init.sh
# RUN ./init.sh
ENTRYPOINT ./init.sh && bash
# CMD ["/bin/bash"]
# docker run -e "EOS_VERSION=latest" -e "CONTRACT_VERSION=release/1.8.x" -e "CDT_VERSION=v1.6.3" --rm -ti helixious86/eos_base_image:centos7.v1.1
# RUN chmod +x install_deb.sh && ./install_deb.sh $cdt_release $eos_release $contract_release && rm -f install_deb.sh