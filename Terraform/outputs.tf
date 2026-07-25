output "instance_public_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_instance.micros.public_ip
}

output "instance_url" {
  description = "Application URL"
  value       = "https://microcalorietracker.online"
}
