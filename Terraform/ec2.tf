#keypair login
resource "aws_key_pair" "micros-key" {
  key_name   = "micros-key"
  public_key = file("micros-key.pub")
}

#vpc and security group
resource "aws_default_vpc" "default" {

}

resource "aws_security_group" "micros-sg" {
  name        = "micros-sg"
  description = "Allow SSH and HTTP inbound traffic"
  vpc_id      = aws_default_vpc.default.id #interpolation

  tags = {
    Name = "micros-sg"
  }

  #inbound rules
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${chomp(data.http.my_ip.response_body)}/32"]
    description = "allow SSH from my ip"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "allow HTTP from anywhere"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "allow HTTPS from anywhere"
  }

  #outbound rules
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "allow all outbound traffic"
  }

}

resource "aws_instance" "micros" {
  key_name        = aws_key_pair.micros-key.key_name
  security_groups = [aws_security_group.micros-sg.name]
  instance_type   = "t2.micro"
  ami             = "ami-0b6d9d3d33ba97d99" #ubuntu
  user_data       = file("setup.sh")
  user_data_replace_on_change = true

  #volume block
  root_block_device {
    volume_type = "gp3"
    volume_size = 15
  }

  tags = {
    Name = "micros"
  }
}

# EBS volume for MySQL data persistence
resource "aws_ebs_volume" "mysql_data" {
  availability_zone = aws_instance.micros.availability_zone
  size              = 5
  type              = "gp3"
  tags = {
    Name = "micros-mysql-data"
  }
}

resource "aws_volume_attachment" "mysql_data_attach" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.mysql_data.id
  instance_id = aws_instance.micros.id
}
